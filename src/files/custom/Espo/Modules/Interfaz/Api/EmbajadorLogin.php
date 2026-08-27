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

        // Resolvemos el nombre de la oficina aquí mismo (acceso interno),
        // así la API key pública no necesita permiso de lectura sobre Team.
        $oficina = null;
        $teamIds = $embajador->get('teamsIds') ?? [];
        if (!empty($teamIds[0])) {
            $team = $this->entityManager->getEntity('Team', $teamIds[0]);
            if ($team) {
                $oficina = $team->get('name');
            }
        }

        // Igual que con la oficina: resolvemos el asesor asignado (nombre y
        // teléfono) acá adentro, con acceso interno directo a EntityManager, para
        // no tener que darle a la API key pública del portal permiso de lectura
        // sobre User (que expondría de más). El portal usa esto para el botón
        // "Contactar al asesor".
        $asesorNombre = null;
        $asesorTelefono = null;
        $assignedUserId = $embajador->get('assignedUserId');
        if ($assignedUserId) {
            $asesorUser = $this->entityManager->getEntity('User', $assignedUserId);
            if ($asesorUser) {
                $asesorNombre = $asesorUser->get('name');
                $asesorTelefono = $asesorUser->get('phoneNumber');
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
