<?php
/**
 * Ruta en servidor Espo:
 * custom/Espo/Modules/Interfaz/Api/EmbajadorChangePassword.php
 *   (ajustar "Interfaz" al namespace real de tu módulo ext-interfaz)
 *
 * Revalida la contraseña actual internamente y guarda la nueva.
 * Como cPassword es tipo de campo "Password", Espo la hashea solo
 * al guardar (mismo mecanismo que usa para User).
 */

namespace Espo\Modules\Interfaz\Api;

use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Core\Exceptions\BadRequest;
use Espo\Core\ORM\EntityManager;

class EmbajadorChangePassword implements Action
{
    public function __construct(
        private EntityManager $entityManager
    ) {}

    public function process(Request $request): Response
    {
        $body = json_decode($request->getBodyContents() ?? '', true) ?: [];

        $ambassadorId   = (string)($body['ambassadorId'] ?? '');
        $passwordActual = (string)($body['passwordActual'] ?? '');
        $passwordNueva  = (string)($body['passwordNueva'] ?? '');

        if ($ambassadorId === '' || $passwordActual === '' || $passwordNueva === '') {
            throw new BadRequest('Faltan datos.');
        }
        if (strlen($passwordNueva) < 8) {
            throw new BadRequest('La nueva contraseña debe tener al menos 8 caracteres.');
        }

        $embajador = $this->entityManager->getEntity('CAmbassador', $ambassadorId);

        if (!$embajador) {
            return ResponseComposer::json(['success' => false]);
        }

        $hashActual = $embajador->get('cPassword');

        // Mismo motivo que en EmbajadorLogin: cPassword se hashea vía Formula con
        // password\hash() (bcrypt), no con el mecanismo interno de Espo para el
        // campo password del User del sistema. Se verifica con password_verify()
        // nativo, que es el que corresponde a ese hash.
        if (!$hashActual || !password_verify($passwordActual, $hashActual)) {
            return ResponseComposer::json(['success' => false, 'reason' => 'wrong_password']);
        }

        // Al guardar vía ORM, el Formula "Before Save Script" detecta que cPassword
        // cambió y no mide 60 caracteres (texto plano), y la hashea automáticamente.
        $embajador->set('cPassword', $passwordNueva);
        $this->entityManager->saveEntity($embajador);

        return ResponseComposer::json(['success' => true]);
    }
}
