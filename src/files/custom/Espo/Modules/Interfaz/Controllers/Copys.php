<?php
namespace Espo\Modules\Interfaz\Controllers;

use Espo\Core\Exceptions\BadRequest;
use Espo\Core\Exceptions\Forbidden;

class Copys extends \Espo\Core\Controllers\Record
{
    // Extensiones/mimes permitidos: PDF, imágenes, Word, Excel, PowerPoint
    private $extensionesPermitidas = [
        'pdf',
        'jpg', 'jpeg', 'png', 'gif', 'webp',
        'doc', 'docx',
        'xls', 'xlsx',
        'ppt', 'pptx'
    ];

    private $mimesPermitidos = [
        'application/pdf',
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];

    public function getActionGetLista($params, $data, $request)
    {
        try {
            $entityManager = $this->getContainer()->get('entityManager');
            $pdo           = $entityManager->getPDO();
            $siteUrl       = rtrim($this->getContainer()->get('config')->get('siteUrl', ''), '/');

            $user = $this->getContainer()->get('user');
            $userInfo = $this->getUserFullInfo($user->get('id'), $pdo);
            $esAdmin = $user->isAdmin();
            $esCasaNacional = $userInfo && in_array('casa nacional', $userInfo['roles']);
            $verTodo = $esAdmin || $esCasaNacional;

            $rolesUsuario = $userInfo ? $userInfo['roles'] : [];

            $sql = "SELECT
                        c.id,
                        c.nombre,
                        c.descripcion,
                        c.orden,
                        c.roles,
                        c.archivo_id,
                        a.name AS archivo_nombre,
                        a.size AS archivo_size,
                        a.type AS archivo_tipo
                    FROM copy c
                    LEFT JOIN attachment a ON a.id = c.archivo_id AND a.deleted = 0
                    WHERE c.deleted = 0
                    ORDER BY c.orden ASC, c.created_at ASC";

            $sth = $pdo->prepare($sql);
            $sth->execute();
            $rows = $sth->fetchAll(\PDO::FETCH_ASSOC);

            $lista = [];
            foreach ($rows as $row) {
                $rolesDoc = $this->parseRoles($row['roles']);

                if (!$verTodo) {
                    // Se muestra si el usuario tiene AL MENOS UNO de los roles
                    // asignados al documento (los roles no son excluyentes entre sí).
                    $tieneAcceso = false;
                    foreach ($rolesDoc as $rolDoc) {
                        if (in_array($rolDoc, $rolesUsuario)) {
                            $tieneAcceso = true;
                            break;
                        }
                    }
                    if (!$tieneAcceso) {
                        continue;
                    }
                }

                $lista[] = [
                    'id'            => $row['id'],
                    'nombre'        => $row['nombre'],
                    'descripcion'   => $row['descripcion'],
                    'orden'         => (int) $row['orden'],
                    'roles'         => $rolesDoc,
                    'archivoId'     => $row['archivo_id'],
                    'archivoNombre' => $row['archivo_nombre'],
                    'archivoSize'   => $row['archivo_size'] !== null ? (int) $row['archivo_size'] : null,
                    'archivoTipo'   => $row['archivo_tipo'],
                    'downloadUrl'   => $row['archivo_id']
                        ? $siteUrl . '/?entryPoint=copyDescargar&id=' . $row['id']
                        : null,
                ];
            }

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

            $nombre      = trim((string) ($_POST['nombre'] ?? $request->get('nombre', '')));
            $descripcion = trim((string) ($_POST['descripcion'] ?? $request->get('descripcion', '')));
            $rolesRaw    = (string) ($_POST['roles'] ?? $request->get('roles', ''));

            if ($nombre === '') {
                throw new BadRequest("El nombre es obligatorio");
            }

            if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
                throw new BadRequest("No se recibió ningún archivo o hubo un error de subida");
            }

            $file = $_FILES['file'];
            $this->validarArchivo($file);

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
                'relatedType' => 'Copy',
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

            $pdo = $entityManager->getPDO();
            $sth = $pdo->prepare("SELECT COALESCE(MAX(orden), 0) AS maxOrden FROM copy WHERE deleted = 0");
            $sth->execute();
            $maxOrden = (int) $sth->fetch(\PDO::FETCH_ASSOC)['maxOrden'];

            $rolesLimpios = $this->normalizarRoles($rolesRaw);

            $copy = $entityManager->getNewEntity('Copy');
            $copy->set([
                'nombre'      => $nombre,
                'descripcion' => $descripcion,
                'roles'       => $rolesLimpios,
                'archivoId'   => $attachmentId,
                'orden'       => $maxOrden + 1,
            ]);
            $entityManager->saveEntity($copy);

            $attachment->set('relatedId', $copy->getId());
            $entityManager->saveEntity($attachment);

            $siteUrl = rtrim($this->getContainer()->get('config')->get('siteUrl', ''), '/');

            return [
                'success' => true,
                'copy' => [
                    'id'            => $copy->getId(),
                    'nombre'        => $nombre,
                    'descripcion'   => $descripcion,
                    'roles'         => $this->parseRoles($rolesLimpios),
                    'orden'         => $maxOrden + 1,
                    'archivoId'     => $attachmentId,
                    'archivoNombre' => $name,
                    'archivoSize'   => (int) $file['size'],
                    'archivoTipo'   => $type,
                    'downloadUrl'   => $siteUrl . '/?entryPoint=copyDescargar&id=' . $copy->getId(),
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

    public function postActionActualizar($params, $data, $request)
    {
        try {
            $this->checkEsCasaNacional();

            $id          = (string) ($_POST['id'] ?? $request->get('id', ''));
            $nombre      = trim((string) ($_POST['nombre'] ?? $request->get('nombre', '')));
            $descripcion = trim((string) ($_POST['descripcion'] ?? $request->get('descripcion', '')));
            $rolesRaw    = (string) ($_POST['roles'] ?? $request->get('roles', ''));

            if (!$id) {
                throw new BadRequest("ID no proporcionado");
            }

            if ($nombre === '') {
                throw new BadRequest("El nombre es obligatorio");
            }

            $entityManager = $this->getContainer()->get('entityManager');
            $copy = $entityManager->getEntity('Copy', $id);

            if (!$copy) {
                throw new BadRequest("Documento no encontrado");
            }

            $rolesLimpios = $this->normalizarRoles($rolesRaw);

            $copy->set([
                'nombre'      => $nombre,
                'descripcion' => $descripcion,
                'roles'       => $rolesLimpios,
            ]);

            // El archivo es opcional al editar: solo se reemplaza si mandaron uno nuevo
            $archivoNuevoId = null;
            $archivoNuevoNombre = null;
            $archivoNuevoTipo = null;
            $archivoNuevoSize = null;

            if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
                $file = $_FILES['file'];
                $this->validarArchivo($file);

                $content = file_get_contents($file['tmp_name']);
                $name    = basename($file['name']);
                $type    = $file['type'];

                $attachment = $entityManager->getNewEntity('Attachment');
                $attachment->set([
                    'name'        => $name,
                    'type'        => $type,
                    'size'        => $file['size'],
                    'role'        => 'Attachment',
                    'relatedType' => 'Copy',
                    'field'       => 'archivo',
                    'relatedId'   => $id,
                ]);
                $entityManager->saveEntity($attachment);

                $attachmentId = $attachment->getId();
                $rootDir   = dirname(__DIR__, 5);
                $uploadDir = $rootDir . '/data/upload/';

                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0775, true);
                }

                if (file_put_contents($uploadDir . $attachmentId, $content) === false) {
                    $entityManager->removeEntity($attachment);
                    throw new BadRequest("No se pudo guardar el archivo");
                }

                // Borrar el attachment viejo para no dejar basura
                $archivoViejoId = $copy->get('archivoId');
                if ($archivoViejoId) {
                    $attachmentViejo = $entityManager->getEntity('Attachment', $archivoViejoId);
                    if ($attachmentViejo) {
                        $entityManager->removeEntity($attachmentViejo);
                    }
                }

                $copy->set('archivoId', $attachmentId);

                $archivoNuevoId = $attachmentId;
                $archivoNuevoNombre = $name;
                $archivoNuevoTipo = $type;
                $archivoNuevoSize = (int) $file['size'];
            }

            $entityManager->saveEntity($copy);

            $siteUrl = rtrim($this->getContainer()->get('config')->get('siteUrl', ''), '/');
            $archivoIdFinal = $archivoNuevoId ?: $copy->get('archivoId');

            $respuesta = [
                'id'          => $id,
                'nombre'      => $nombre,
                'descripcion' => $descripcion,
                'roles'       => $this->parseRoles($rolesLimpios),
                'downloadUrl' => $archivoIdFinal
                    ? $siteUrl . '/?entryPoint=copyDescargar&id=' . $id
                    : null,
            ];

            if ($archivoNuevoId) {
                $respuesta['archivoId'] = $archivoNuevoId;
                $respuesta['archivoNombre'] = $archivoNuevoNombre;
                $respuesta['archivoTipo'] = $archivoNuevoTipo;
                $respuesta['archivoSize'] = $archivoNuevoSize;
            }

            return ['success' => true, 'copy' => $respuesta];

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

            $sth = $pdo->prepare("UPDATE copy SET orden = ?, modified_at = NOW() WHERE id = ? AND deleted = 0");

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

            $copyId = $body['id'] ?? null;
            if (!$copyId) {
                throw new BadRequest("ID no proporcionado");
            }

            $entityManager = $this->getContainer()->get('entityManager');
            $copy = $entityManager->getEntity('Copy', $copyId);

            if (!$copy) {
                throw new BadRequest("Documento no encontrado");
            }

            $archivoId = $copy->get('archivoId');

            $entityManager->removeEntity($copy);

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

    private function validarArchivo($file)
    {
        $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

        if (!in_array($extension, $this->extensionesPermitidas)) {
            throw new BadRequest("Tipo de archivo no permitido. Se aceptan: PDF, imágenes, Word, Excel y PowerPoint");
        }

        if (!in_array($file['type'], $this->mimesPermitidos)) {
            throw new BadRequest("Tipo de archivo no permitido. Se aceptan: PDF, imágenes, Word, Excel y PowerPoint");
        }
    }

    // "asesor, Gerente ,coordinador" -> "asesor,gerente,coordinador"
    private function normalizarRoles($rolesRaw)
    {
        $partes = explode(',', $rolesRaw);
        $limpias = [];

        foreach ($partes as $p) {
            $p = strtolower(trim($p));
            if ($p !== '' && !in_array($p, $limpias)) {
                $limpias[] = $p;
            }
        }

        return implode(',', $limpias);
    }

    private function parseRoles($rolesStr)
    {
        if (!$rolesStr) return [];
        return array_values(array_filter(array_map('trim', explode(',', $rolesStr))));
    }

    private function checkEsCasaNacional()
    {
        $user = $this->getContainer()->get('user');

        if ($user->isAdmin()) {
            return;
        }

        $entityManager = $this->getContainer()->get('entityManager');
        $pdo = $entityManager->getPDO();
        $userInfo = $this->getUserFullInfo($user->get('id'), $pdo);

        if (!$userInfo || !in_array('casa nacional', $userInfo['roles'])) {
            throw new Forbidden("No tiene permisos para realizar esta acción");
        }
    }

    private function getUserFullInfo($userId, $pdo)
    {
        try {
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
