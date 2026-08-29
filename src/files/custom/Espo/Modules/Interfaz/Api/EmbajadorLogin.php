<?php
/**
 * Ruta en servidor Espo:
 * custom/Espo/Modules/Interfaz/Api/EmbajadorLogin.php
 *   (ajustar "Interfaz" al namespace real de tu módulo ext-interfaz)
 *
 * Verifica usuario/password de un CAmbassador SIN exponer nunca
 * el hash de cPassword hacia afuera. Requiere que cPassword sea
 * de tipo de campo "Password" en Studio.
 */

namespace Espo\Modules\Interfaz\Api;

use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Core\Exceptions\BadRequest;
use Espo\Core\ORM\EntityManager;

class EmbajadorLogin implements Action
{
    public function __construct(
        private EntityManager $entityManager
    ) {}

    public function process(Request $request): Response
    {
        $body = json_decode($request->getBodyContents() ?? '', true) ?: [];

        $usuario  = trim((string)($body['usuario'] ?? ''));
        $password = (string)($body['password'] ?? '');

        if ($usuario === '' || $password === '') {
            throw new BadRequest('Usuario y password son requeridos.');
        }

        $embajador = $this->entityManager
            ->getRDBRepository('CAmbassador')
            ->where(['cUsuario' => $usuario])
            ->findOne();

        if (!$embajador) {
            return ResponseComposer::json(['success' => false]);
        }

        // El status debe estar Activo. Valor técnico "2" = Activo
        // (confirmar en Administración > Entity Manager > CAmbassador > Fields > status).
        if ((string)$embajador->get('status') !== '2') {
            return ResponseComposer::json(['success' => false, 'reason' => 'inactive']);
        }

        $hash = $embajador->get('cPassword');

        // IMPORTANTE: cPassword NO es un campo tipo "Password" nativo de Espo — es
        // un Varchar que un Formula "Before Save Script" hashea con password\hash()
        // (bcrypt, produce un string de 60 caracteres). Por eso se verifica con
        // password_verify() nativo de PHP, NO con Espo\Core\Utils\PasswordHash (esa
        // clase es para el campo password del User del sistema, con su propio
        // esquema/sal — comparar contra ella acá siempre daba falso, sin importar
        // que la contraseña estuviera correcta).
        if (!$hash || !password_verify($password, $hash)) {
            return ResponseComposer::json(['success' => false]);
        }

        // Resolvemos el nombre de la oficina y los datos del asesor asignado
        // acá mismo (acceso interno vía EntityManager), así la API key pública
        // del portal no necesita permiso de lectura sobre Team/User.
        //
        // OJO: la oficina NO sale de los equipos del propio embajador — CAmbassador
        // no tiene esa relación poblada. La oficina real es la del ASESOR asignado
        // (mismo criterio que usa Usuarios::getUserFullInfo en el panel admin):
        // se toma el primer equipo del asesor que no sea un CLA (patrón "CLA123")
        // ni el equipo genérico "venezuela".
        $oficina = null;
        $asesorNombre = null;
        $asesorTelefono = null;
        $assignedUserId = $embajador->get('assignedUserId');

        if ($assignedUserId) {
            $asesorUser = $this->entityManager->getEntity('User', $assignedUserId);

            if ($asesorUser) {
                $asesorNombre = $asesorUser->get('name');
                $asesorTelefono = $asesorUser->get('phoneNumber');

                $teamIds = $asesorUser->get('teamsIds') ?? [];
                $claPattern = '/^CLA\d+$/i';

                foreach ($teamIds as $teamId) {
                    if (!preg_match($claPattern, $teamId) && strtolower($teamId) !== 'venezuela') {
                        $team = $this->entityManager->getEntity('Team', $teamId);
                        if ($team) {
                            $oficina = $team->get('name');
                        }
                        break;
                    }
                }
            }
        }

        // Solo datos públicos — nunca cPassword.
        return ResponseComposer::json([
            'success' => true,
            'ambassador' => [
                'id'             => $embajador->getId(),
                'name'           => $embajador->get('name'),
                'firstName'      => $embajador->get('firstName'),
                'lastName'       => $embajador->get('lastName'),
                'phoneNumber'    => $embajador->get('phoneNumber'),
                'emailAddress'   => $embajador->get('emailAddress'),
                'assignedUserId' => $embajador->get('assignedUserId'),
                'teamsIds'       => $embajador->get('teamsIds'),
                'oficina'        => $oficina,
                'asesorNombre'   => $asesorNombre,
                'asesorTelefono' => $asesorTelefono,
                // 'fotoId' => $embajador->get('NOMBRE_REAL_DEL_CAMPO_FOTO'),
            ],
        ]);
    }
}
