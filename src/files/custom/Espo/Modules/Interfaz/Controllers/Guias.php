<?php
namespace Espo\Modules\Interfaz\Controllers;

use Espo\Core\Exceptions\BadRequest;
use Espo\Core\Exceptions\Error;
use Espo\Core\Exceptions\Forbidden;

class Guias extends \Espo\Core\Controllers\Record
{
    public function getActionGetLista($params, $data, $request)
    {
        try {
            $entityManager = $this->getContainer()->get('entityManager');
            $pdo           = $entityManager->getPDO();
            $siteUrl       = rtrim($this->getContainer()->get('config')->get('siteUrl', ''), '/');

            $sql = "SELECT
                        g.id,
                        g.nombre,
                        g.descripcion,
                        g.orden,
                        g.archivo_id,
                        a.name AS archivo_nombre,
                        a.size AS archivo_size
                    FROM guia g
                    LEFT JOIN attachment a ON a.id = g.archivo_id AND a.deleted = 0
                    WHERE g.deleted = 0
                    ORDER BY g.orden ASC, g.created_at ASC";

            $sth = $pdo->prepare($sql);
            $sth->execute();
            $rows = $sth->fetchAll(\PDO::FETCH_ASSOC);

            $lista = array_map(function ($row) use ($siteUrl) {
                return [
                    'id'            => $row['id'],
                    'nombre'        => $row['nombre'],
                    'descripcion'   => $row['descripcion'],
                    'orden'         => (int) $row['orden'],
                    'archivoId'     => $row['archivo_id'],
                    'archivoNombre' => $row['archivo_nombre'],
                    'archivoSize'   => $row['archivo_size'] !== null ? (int) $row['archivo_size'] : null,
                    'downloadUrl'   => $row['archivo_id']
                        ? $siteUrl . '/?entryPoint=download&id=' . $row['archivo_id']
                        : null,
                ];
            }, $rows);

            return [
                'success' => true,
                'data'    => $lista,
            ];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function postActionCrear($params, $data, $request)
    {
        try {
            $this->checkEsCasaNacional();

            // En peticiones multipart/form-data (subida de archivo), los campos de
            // texto llegan a $_POST directamente; $request->get() solo lee query string.
            $nombre      = trim((string) ($_POST['nombre'] ?? $request->get('nombre', '')));
            $descripcion = trim((string) ($_POST['descripcion'] ?? $request->get('descripcion', '')));

            if ($nombre === '') {
                throw new BadRequest("El nombre es obligatorio");
            }

            if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
                throw new BadRequest("No se recibió ningún archivo o hubo un error de subida");
            }

            $file = $_FILES['file'];

            $allowedTypes = ['application/pdf'];
            $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            if (!in_array($file['type'], $allowedTypes) || $extension !== 'pdf') {
                throw new BadRequest("Solo se permiten archivos PDF");
            }

            $entityManager = $this->getContainer()->get('entityManager');
            $content = file_get_contents($file['tmp_name']);
            $name    = basename($file['name']);
            $type    = $file['type'];

            $attachment = $entityManager->getNewEntity('Attachment');
            $attachment->set([
                'name'        => $name,
                'type'        => $type,
                'size'        => $file['size'],
                'role'        => 'Attachment',
                'relatedType' => 'Guia',
                'field'       => 'archivo',
            ]);
            $entityManager->saveEntity($attachment);

            $attachmentId = $attachment->getId();
            $rootDir   = dirname(__DIR__, 5);
            $uploadDir = $rootDir . '/data/upload/';

            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0775, true);
            }

            $targetPath = $uploadDir . $attachmentId;
            if (file_put_contents($targetPath, $content) === false) {
                $entityManager->removeEntity($attachment);
                throw new BadRequest("No se pudo guardar el archivo");
            }

            // Siguiente orden disponible
            $pdo = $entityManager->getPDO();
            $sth = $pdo->prepare("SELECT COALESCE(MAX(orden), 0) AS maxOrden FROM guia WHERE deleted = 0");
            $sth->execute();
            $maxOrden = (int) $sth->fetch(\PDO::FETCH_ASSOC)['maxOrden'];

            $guia = $entityManager->getNewEntity('Guia');
            $guia->set([
                'nombre'      => $nombre,
                'descripcion' => $descripcion,
                'archivoId'   => $attachmentId,
                'orden'       => $maxOrden + 1,
            ]);
            $entityManager->saveEntity($guia);

            $attachment->set('relatedId', $guia->getId());
            $entityManager->saveEntity($attachment);

            $siteUrl = rtrim($this->getContainer()->get('config')->get('siteUrl', ''), '/');

            return [
                'success' => true,
                'guia' => [
                    'id'            => $guia->getId(),
                    'nombre'        => $nombre,
                    'descripcion'   => $descripcion,
                    'orden'         => $maxOrden + 1,
                    'archivoId'     => $attachmentId,
                    'archivoNombre' => $name,
                    'archivoSize'   => (int) $file['size'],
                    'downloadUrl'   => $siteUrl . '/?entryPoint=download&id=' . $attachmentId,
                ],
            ];

        } catch (BadRequest $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        } catch (Forbidden $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function postActionActualizarOrden($params, $data, $request)
    {
        try {
            $this->checkEsCasaNacional();

            $body = $request->getParsedBody();
            if (is_object($body)) $body = (array) $body;

            $orden = $body['orden'] ?? null;
            if (!is_array($orden) || empty($orden)) {
                throw new BadRequest("Lista de orden no proporcionada");
            }

            $entityManager = $this->getContainer()->get('entityManager');
            $pdo = $entityManager->getPDO();

            $sth = $pdo->prepare("UPDATE guia SET orden = ?, modified_at = NOW() WHERE id = ? AND deleted = 0");

            foreach ($orden as $item) {
                $item = (array) $item;
                if (!isset($item['id']) || !isset($item['orden'])) {
                    continue;
                }
                $sth->execute([(int) $item['orden'], $item['id']]);
            }

            return ['success' => true];

        } catch (BadRequest $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        } catch (Forbidden $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function postActionEliminar($params, $data, $request)
    {
        try {
            $this->checkEsCasaNacional();

            $body = $request->getParsedBody();
            if (is_object($body)) $body = (array) $body;

            $guiaId = $body['id'] ?? null;
            if (!$guiaId) {
                throw new BadRequest("ID de guía no proporcionado");
            }

            $entityManager = $this->getContainer()->get('entityManager');
            $guia = $entityManager->getEntity('Guia', $guiaId);

            if (!$guia) {
                throw new BadRequest("Guía no encontrada");
            }

            $archivoId = $guia->get('archivoId');

            $entityManager->removeEntity($guia);

            if ($archivoId) {
                $attachment = $entityManager->getEntity('Attachment', $archivoId);
                if ($attachment) {
                    $entityManager->removeEntity($attachment);
                }
            }

            return ['success' => true];

        } catch (BadRequest $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        } catch (Forbidden $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    private function checkEsCasaNacional()
    {
        $user = $this->getContainer()->get('user');

        if ($user->isAdmin()) {
            return;
        }

        $userInfo = $this->getUserFullInfo($user->get('id'));
        if (!$userInfo || !$this->hasRole($userInfo, 'casa nacional')) {
            throw new Forbidden("No tiene permisos para realizar esta acción");
        }
    }

    private function hasRole($userInfo, $roleName)
    {
        if (!$userInfo || !isset($userInfo['roles'])) {
            return false;
        }

        $roleNameLower = strtolower($roleName);
        return in_array($roleNameLower, $userInfo['roles']);
    }

    private function getUserFullInfo($userId)
    {
        try {
            $entityManager = $this->getContainer()->get('entityManager');
            $pdo = $entityManager->getPDO();

            $sql = "SELECT
                        u.id,
                        GROUP_CONCAT(DISTINCT LOWER(r.name)) as roles
                    FROM user u
                    LEFT JOIN role_user ru ON u.id = ru.user_id AND ru.deleted = 0
                    LEFT JOIN role r ON ru.role_id = r.id AND r.deleted = 0
                    WHERE u.id = ?
                    AND u.deleted = 0
                    GROUP BY u.id
                    LIMIT 1";

            $sth = $pdo->prepare($sql);
            $sth->execute([$userId]);

            $userData = $sth->fetch(\PDO::FETCH_ASSOC);

            if (!$userData) {
                return null;
            }

            $roles = $userData['roles'] ? explode(',', $userData['roles']) : [];

            return [
                'id'    => $userId,
                'roles' => $roles,
            ];

        } catch (\Exception $e) {
            return null;
        }
    }
}
