<?php
namespace Espo\Modules\Interfaz\Controllers;

use Espo\Core\Exceptions\Error;
use Espo\Core\Exceptions\BadRequest;

class Embajadores extends \Espo\Core\Controllers\Record
{
    public function getActionGetLista($params, $data, $request)
    {
        try {
            $entityManager = $this->getContainer()->get('entityManager');
            $user          = $this->getContainer()->get('user');
            $pdo           = $entityManager->getPDO();
            $siteUrl       = rtrim($this->getContainer()->get('config')->get('siteUrl', ''), '/');

            $userInfo = $this->getUserFullInfo($user->get('id'), $pdo);
            if (!$userInfo) {
                throw new Error("No se pudo obtener información del usuario");
            }

            $pagina    = (int)$request->get('pagina', 1);
            $porPagina = (int)$request->get('porPagina', 25);
            $offset    = ($pagina - 1) * $porPagina;

            $claId     = $request->get('claId');
            $oficinaId = $request->get('oficinaId');
            $asesorId  = $request->get('asesorId');
            $status    = $request->get('status');
            $nombre    = trim((string) $request->get('nombre', ''));

            $esAdmin   = $user->isAdmin();
            $esCN      = $esAdmin || $userInfo['esCasaNacional'];
            $esGestion = $userInfo['esGerente'] || $userInfo['esDirector'] || $userInfo['esCoordinador'];

            $sql = "SELECT DISTINCT
                        a.id,
                        a.first_name,
                        a.last_name,
                        a.status,
                        a.created_at,
                        a.photo_id,
                        a.assigned_user_id,
                        CONCAT(u.first_name, ' ', u.last_name) as assigned_user_name,
                        ea.lower as email_address
                    FROM c_ambassador a
                    LEFT JOIN user u ON a.assigned_user_id = u.id AND u.deleted = 0
                    LEFT JOIN entity_email_address eea
                        ON eea.entity_id = a.id
                        AND eea.entity_type = 'CAmbassador'
                        AND eea.primary = 1
                        AND eea.deleted = 0
                    LEFT JOIN email_address ea
                        ON ea.id = eea.email_address_id
                        AND ea.deleted = 0
                    LEFT JOIN team_user tu
                        ON tu.user_id = a.assigned_user_id
                        AND tu.deleted = 0
                    LEFT JOIN team t
                        ON t.id = tu.team_id
                        AND t.deleted = 0
                        AND t.id NOT LIKE 'CLA%'
                        AND LOWER(t.id) != 'venezuela'
                    WHERE a.deleted = 0";

            $params = [];

            if (!$esCN && !$esGestion) {
                $sql .= " AND a.assigned_user_id = :userId";
                $params[':userId'] = $user->get('id');
            } elseif ($esGestion && !$esCN) {
                $sql .= " AND tu.team_id = :oficinaUsuario";
                $params[':oficinaUsuario'] = $userInfo['oficinaId'];
            }

            if ($claId) {
                $sql .= " AND tu.team_id IN (
                    SELECT DISTINCT tu2.team_id
                    FROM team_user tu2
                    INNER JOIN team_user tu3 ON tu2.user_id = tu3.user_id
                    WHERE tu3.team_id = :claId AND tu2.deleted = 0 AND tu3.deleted = 0
                    AND tu2.team_id NOT LIKE 'CLA%'
                )";
                $params[':claId'] = $claId;
            }

            if ($oficinaId) {
                $sql .= " AND tu.team_id = :oficinaId";
                $params[':oficinaId'] = $oficinaId;
            }

            if ($asesorId) {
                $sql .= " AND a.assigned_user_id = :asesorId";
                $params[':asesorId'] = $asesorId;
            }

            if ($status !== null && $status !== '') {
                $sql .= " AND a.status = :status";
                $params[':status'] = $status;
            }

            if ($nombre !== '') {
                $sql .= " AND LOWER(CONCAT(COALESCE(a.first_name,''), ' ', COALESCE(a.last_name,''))) LIKE :nombre";
                $params[':nombre'] = '%' . mb_strtolower($nombre) . '%';
            }

            $sql .= " ORDER BY a.created_at DESC";

            $sqlCount = "SELECT COUNT(*) as total FROM (" . $sql . ") as sub";
            $sthCount = $pdo->prepare($sqlCount);
            foreach ($params as $k => $v) {
                $sthCount->bindValue($k, $v);
            }
            $sthCount->execute();
            $total = (int)$sthCount->fetch(\PDO::FETCH_ASSOC)['total'];

            $sql .= " LIMIT :offset, :limit";
            $sth = $pdo->prepare($sql);
            foreach ($params as $k => $v) {
                $sth->bindValue($k, $v);
            }
            $sth->bindValue(':offset', $offset, \PDO::PARAM_INT);
            $sth->bindValue(':limit',  $porPagina, \PDO::PARAM_INT);
            $sth->execute();

            $fotoFallback = $this->getFotoFallback($pdo, $siteUrl);

            $embajadores = [];
            while ($row = $sth->fetch(\PDO::FETCH_ASSOC)) {
                $photoUrl = null;
                if (!empty($row['photo_id'])) {
                    $photoUrl = $siteUrl . '/?entryPoint=image&id=' . $row['photo_id'];
                } else {
                    $photoUrl = $fotoFallback;
                }

                $teamName = $this->getOficinaNameByUser($row['assigned_user_id'], $pdo);

                $embajadores[] = [
                    'id'               => $row['id'],
                    'firstName'        => $row['first_name'],
                    'lastName'         => $row['last_name'],
                    'emailAddress'     => $row['email_address'],
                    'status'           => $row['status'],
                    'createdAt'        => $row['created_at'],
                    'photoUrl'         => $photoUrl,
                    'assignedUserId'   => $row['assigned_user_id'],
                    'assignedUserName' => trim($row['assigned_user_name'] ?? ''),
                    'teamName'         => $teamName
                ];
            }

            return [
                'success'      => true,
                'data'         => $embajadores,
                'total'        => $total,
                'pagina'       => $pagina,
                'porPagina'    => $porPagina,
                'totalPaginas' => (int)ceil($total / $porPagina)
            ];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage(), 'data' => []];
        }
    }

    public function getActionGetDetalle($params, $data, $request)
    {
        try {
            $embId = $request->get('embajadorId');
            if (!$embId) {
                return ['success' => false, 'error' => 'ID no proporcionado'];
            }

            $entityManager = $this->getContainer()->get('entityManager');
            $pdo           = $entityManager->getPDO();
            $siteUrl       = rtrim($this->getContainer()->get('config')->get('siteUrl', ''), '/');

            $sql = "SELECT
                        a.id,
                        a.code,
                        a.status,
                        a.first_name,
                        a.last_name,
                        a.cedula,
                        a.description,
                        a.address_street,
                        a.address_city,
                        a.address_state,
                        a.address_country,
                        a.address_postal_code,
                        a.record_count,
                        a.carnet,
                        a.porcentaje,
                        a.qr,
                        a.c_usuario,
                        a.c_password,
                        a.photo_id,
                        a.assigned_user_id,
                        a.created_at,
                        CONCAT(u.first_name, ' ', u.last_name) as assigned_user_name,
                        ea.lower as email_address,
                        pn.numeric as phone_number
                    FROM c_ambassador a
                    LEFT JOIN user u ON a.assigned_user_id = u.id AND u.deleted = 0
                    LEFT JOIN entity_email_address eea
                        ON eea.entity_id = a.id
                        AND eea.entity_type = 'CAmbassador'
                        AND eea.primary = 1
                        AND eea.deleted = 0
                    LEFT JOIN email_address ea
                        ON ea.id = eea.email_address_id
                        AND ea.deleted = 0
                    LEFT JOIN entity_phone_number epn
                        ON epn.entity_id = a.id
                        AND epn.entity_type = 'CAmbassador'
                        AND epn.primary = 1
                        AND epn.deleted = 0
                    LEFT JOIN phone_number pn
                        ON pn.id = epn.phone_number_id
                        AND pn.deleted = 0
                    WHERE a.id = ?
                    AND a.deleted = 0
                    LIMIT 1";

            $sth = $pdo->prepare($sql);
            $sth->execute([$embId]);
            $row = $sth->fetch(\PDO::FETCH_ASSOC);

            if (!$row) {
                return ['success' => false, 'error' => 'Embajador no encontrado'];
            }

            // Foto con fallback al usuario '0'
            $photoUrl = null;
            $photoEditable = true;
            if (!empty($row['photo_id'])) {
                $photoUrl = $siteUrl . '/?entryPoint=image&id=' . $row['photo_id'];
            } else {
                $photoUrl = $this->getFotoFallback($pdo, $siteUrl);
            }

            // QR — usa el assigned_user_id, no el id del embajador
            $qrImageUrl = null;
            if (!empty($row['qr']) && !empty($row['assigned_user_id'])) {
                $qrImageUrl = $siteUrl . '/?entryPoint=qrCode&userId=' . $row['assigned_user_id'] . '&tipo=ambassador&ambassadorId=' . $embId;
            }

            $teamName = $this->getOficinaNameByUser($row['assigned_user_id'], $pdo);
            $teamId   = $this->getOficinaIdByUser($row['assigned_user_id'], $pdo);

            $sqlDocs = "SELECT id, name, type, size
                        FROM attachment
                        WHERE related_id = ?
                        AND related_type = 'CAmbassador'
                        AND field = 'documentos'
                        AND deleted = 0
                        ORDER BY created_at DESC";
            $sthDocs = $pdo->prepare($sqlDocs);
            $sthDocs->execute([$embId]);
            $documentos = [];
            while ($doc = $sthDocs->fetch(\PDO::FETCH_ASSOC)) {
                $documentos[] = [
                    'id'   => $doc['id'],
                    'name' => $doc['name'],
                    'type' => $doc['type'],
                    'size' => $doc['size'],
                    'url'  => $siteUrl . '/?entryPoint=download&id=' . $doc['id']
                ];
            }

            $sqlNotes = "SELECT
                            n.id, n.post, n.created_at, n.created_by_id,
                            CONCAT(u2.first_name, ' ', u2.last_name) as autor_nombre,
                            u2.avatar_id as autor_avatar_id
                         FROM note n
                         INNER JOIN note_user nu ON n.id = nu.note_id
                         LEFT JOIN user u2 ON n.created_by_id = u2.id AND u2.deleted = 0
                         WHERE nu.user_id = ?
                         AND nu.deleted = 0
                         AND n.deleted = 0
                         AND n.type = 'Post'
                         ORDER BY n.created_at DESC";
            $sthNotes = $pdo->prepare($sqlNotes);
            $sthNotes->execute([$embId]);
            $notas = [];
            while ($nota = $sthNotes->fetch(\PDO::FETCH_ASSOC)) {
                $autorAvatar = null;
                if ($nota['autor_avatar_id']) {
                    $autorAvatar = $siteUrl . '/?entryPoint=image&id=' . $nota['autor_avatar_id'];
                }
                $notas[] = [
                    'id'          => $nota['id'],
                    'post'        => $nota['post'],
                    'createdAt'   => $nota['created_at'],
                    'autorNombre' => trim($nota['autor_nombre']) ?: 'Usuario',
                    'autorAvatar' => $autorAvatar
                ];
            }

            $statusMap = [
                '0' => 'Pendiente',
                '1' => 'En proceso',
                '2' => 'Activo',
                '3' => 'Inactivo'
            ];

            return [
                'success' => true,
                'data' => [
                    'id'                => $row['id'],
                    'code'              => $row['code'],
                    'status'            => $row['status'],
                    'statusLabel'       => $statusMap[$row['status']] ?? $row['status'],
                    'firstName'         => $row['first_name'],
                    'lastName'          => $row['last_name'],
                    'cedula'            => $row['cedula'],
                    'emailAddress'      => $row['email_address'],
                    'phoneNumber'       => $row['phone_number'],
                    'addressStreet'     => $row['address_street'],
                    'addressCity'       => $row['address_city'],
                    'addressState'      => $row['address_state'],
                    'addressCountry'    => $row['address_country'],
                    'addressPostalCode' => $row['address_postal_code'],
                    'recordCount'       => $row['record_count'],
                    'carnet'            => $row['carnet'],
                    'description'       => $row['description'],
                    'porcentaje'        => $row['porcentaje'],
                    'usuario'           => $row['c_usuario'],
                    // El valor de cPassword (hash) NUNCA se manda al frontend, solo
                    // si tiene uno establecido o no, para poder mostrar el campo
                    // como "Establecida" / "No establecida" sin exponer el hash.
                    'passwordEstablecida' => !empty($row['c_password']),
                    'qr'                => $row['qr'],
                    'qrImageUrl'        => $qrImageUrl,
                    'photoUrl'          => $photoUrl,
                    'photoEditable'     => empty($row['photo_id']),
                    'assignedUserId'    => $row['assigned_user_id'],
                    'assignedUserName'  => trim($row['assigned_user_name'] ?? ''),
                    'teamName'          => $teamName,
                    'teamId'            => $teamId,
                    'documentos'        => $documentos,
                    'notas'             => $notas
                ]
            ];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function postActionCrear($params, $data, $request)
    {
        try {
            $user = $this->getContainer()->get('user');
            $userId = $user->get('id');

            $entityManager = $this->getContainer()->get('entityManager');
            $pdo = $entityManager->getPDO();
            $siteUrl = rtrim($this->getContainer()->get('config')->get('siteUrl', ''), '/');

            $teamId = $this->getOficinaIdByUser($userId, $pdo);

            $entity = $entityManager->getNewEntity('CAmbassador');
            $entity->set('status', '0');
            $entity->set('assignedUserId', $userId);

            if ($teamId) {
                $entity->set('teamsIds', [$teamId]);
            }

            $entityManager->saveEntity($entity);
            $embId = $entity->getId();

            // El carnet y el QR ya NO se arman aquí a mano: el Formula "Before Save
            // Script" configurado en Entity Manager sobre CAmbassador los genera
            // automáticamente en cada saveEntity() usando el id real de la entidad
            // (https://portal.century21.com.ve/eb/carnet.php?lerr=<id> y
            // https://portal.century21.com.ve/eb/?lerr=<id>). El UPDATE manual que
            // había aquí antes los pisaba con una URL vieja (century21venezuela.com)
            // justo después de que el Formula los dejara bien.

            return [
                'success' => true,
                'id' => $embId
            ];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function postActionGuardarCampo($params, $data, $request)
    {
        try {
            $body = $request->getParsedBody();
            if (is_object($body)) $body = (array) $body;

            $embajadorId = $body['embajadorId'] ?? null;
            $campo       = $body['campo'] ?? null;
            $valor       = $body['valor'] ?? null;

            if (!$embajadorId || !$campo) {
                return ['success' => false, 'error' => 'Datos incompletos'];
            }

            // 'status' se valida aparte: solo lo puede cambiar gestión/casa nacional/admin
            $camposPermitidos = [
                'first_name', 'last_name', 'cedula', 'address_street',
                'address_city', 'address_state', 'address_country',
                'address_postal_code', 'description', 'porcentaje',
                'c_usuario', 'status'
            ];

            if (!in_array($campo, $camposPermitidos)) {
                return ['success' => false, 'error' => 'Campo no editable'];
            }

            if ($campo === 'status') {
                $user = $this->getContainer()->get('user');
                $pdoCheck = $this->getContainer()->get('entityManager')->getPDO();
                $userInfo = $this->getUserFullInfo($user->get('id'), $pdoCheck);
                $esAdmin = $user->isAdmin();
                $esCN = $esAdmin || ($userInfo && $userInfo['esCasaNacional']);
                $esGestion = $userInfo && ($userInfo['esGerente'] || $userInfo['esDirector'] || $userInfo['esCoordinador']);

                if (!$esCN && !$esGestion) {
                    return ['success' => false, 'error' => 'No tiene permisos para cambiar el estatus'];
                }
            }

            // Validación de porcentaje: entre 0 y 35, máximo 1 decimal
            if ($campo === 'porcentaje') {
                if ($valor === '' || $valor === null) {
                    $valor = null;
                } else {
                    if (!is_numeric($valor)) {
                        return ['success' => false, 'error' => 'El porcentaje debe ser un número'];
                    }
                    $valor = round((float)$valor, 1);
                    if ($valor < 0 || $valor > 35) {
                        return ['success' => false, 'error' => 'El porcentaje debe estar entre 0% y 35%'];
                    }
                }
            }

            $entityManager = $this->getContainer()->get('entityManager');
            $pdo = $entityManager->getPDO();

            $sql = "UPDATE c_ambassador SET `{$campo}` = ?, modified_at = NOW() WHERE id = ? AND deleted = 0";
            $sth = $pdo->prepare($sql);
            $sth->execute([$valor, $embajadorId]);

            return ['success' => true];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function postActionGuardarPassword($params, $data, $request)
    {
        try {
            $body = $request->getParsedBody();
            if (is_object($body)) $body = (array) $body;

            $embajadorId = $body['embajadorId'] ?? null;
            $password    = $body['valor'] ?? null;

            if (!$embajadorId || !$password) {
                return ['success' => false, 'error' => 'Datos incompletos'];
            }

            // IMPORTANTE: a diferencia de guardarCampo (UPDATE SQL directo), acá se
            // usa entityManager->saveEntity() para que SÍ dispare el Formula "Before
            // Save Script" de CAmbassador, que es quien hashea cPassword
            // (password\hash(...)) cuando cambia y no mide ya 60 caracteres. Un
            // UPDATE directo lo guardaría en texto plano y rompería el login del
            // portal de embajadores.
            $entityManager = $this->getContainer()->get('entityManager');
            $entity = $entityManager->getEntity('CAmbassador', $embajadorId);

            if (!$entity) {
                return ['success' => false, 'error' => 'Embajador no encontrado'];
            }

            $entity->set('cPassword', $password);
            $entityManager->saveEntity($entity);

            return ['success' => true];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function postActionGuardarEmail($params, $data, $request)
    {
        try {
            $body = $request->getParsedBody();
            if (is_object($body)) $body = (array) $body;

            $embajadorId = $body['embajadorId'] ?? null;
            $email       = trim($body['valor'] ?? '');

            if (!$embajadorId || !$email) {
                return ['success' => false, 'error' => 'Datos incompletos'];
            }

            // Validar formato de correo
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                return ['success' => false, 'error' => 'El formato del correo electrónico no es válido'];
            }

            $pdo = $this->getContainer()->get('entityManager')->getPDO();

            $sqlCheck = "SELECT ea.id 
                         FROM email_address ea
                         INNER JOIN entity_email_address eea ON ea.id = eea.email_address_id
                         WHERE eea.entity_id = ?
                         AND eea.entity_type = 'CAmbassador'
                         AND eea.primary = 1
                         AND eea.deleted = 0
                         AND ea.deleted = 0
                         LIMIT 1";
            $sthCheck = $pdo->prepare($sqlCheck);
            $sthCheck->execute([$embajadorId]);
            $existing = $sthCheck->fetch(\PDO::FETCH_ASSOC);

            if ($existing) {
                $sql = "UPDATE email_address SET `lower` = ?, name = ?, modified_at = NOW() WHERE id = ?";
                $pdo->prepare($sql)->execute([strtolower($email), $email, $existing['id']]);
            } else {
                $newId = $this->generateId();
                $pdo->prepare("INSERT INTO email_address (id, `lower`, name) VALUES (?, ?, ?)")
                    ->execute([$newId, strtolower($email), $email]);
                $pdo->prepare("INSERT INTO entity_email_address (entity_id, entity_type, email_address_id, `primary`) VALUES (?, 'CAmbassador', ?, 1)")
                    ->execute([$embajadorId, $newId]);
            }

            return ['success' => true];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function postActionGuardarTelefono($params, $data, $request)
    {
        try {
            $body = $request->getParsedBody();
            if (is_object($body)) $body = (array) $body;

            $embajadorId = $body['embajadorId'] ?? null;
            $telefono    = $body['valor'] ?? null;

            if (!$embajadorId || !$telefono) {
                return ['success' => false, 'error' => 'Datos incompletos'];
            }

            $pdo = $this->getContainer()->get('entityManager')->getPDO();

            // `numeric` es palabra reservada en MariaDB, se escapa con backticks
            $sqlCheck = "SELECT pn.id 
                         FROM phone_number pn
                         INNER JOIN entity_phone_number epn ON pn.id = epn.phone_number_id
                         WHERE epn.entity_id = ?
                         AND epn.entity_type = 'CAmbassador'
                         AND epn.primary = 1
                         AND epn.deleted = 0
                         AND pn.deleted = 0
                         LIMIT 1";
            $sthCheck = $pdo->prepare($sqlCheck);
            $sthCheck->execute([$embajadorId]);
            $existing = $sthCheck->fetch(\PDO::FETCH_ASSOC);

            if ($existing) {
                $pdo->prepare("UPDATE phone_number SET `numeric` = ?, name = ?, modified_at = NOW() WHERE id = ?")
                    ->execute([$telefono, $telefono, $existing['id']]);
            } else {
                $newId = $this->generateId();
                $pdo->prepare("INSERT INTO phone_number (id, `numeric`, name) VALUES (?, ?, ?)")
                    ->execute([$newId, $telefono, $telefono]);
                $pdo->prepare("INSERT INTO entity_phone_number (entity_id, entity_type, phone_number_id, `primary`) VALUES (?, 'CAmbassador', ?, 1)")
                    ->execute([$embajadorId, $newId]);
            }

            return ['success' => true];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function postActionSubirFoto($params, $data, $request)
    {
        try {
            $embajadorId = $request->get('embajadorId');
            if (!$embajadorId) {
                throw new BadRequest("ID de embajador no proporcionado");
            }

            if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
                throw new BadRequest("No se recibió ningún archivo o hubo un error de subida");
            }

            $file = $_FILES['file'];
            $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!in_array($file['type'], $allowedTypes)) {
                throw new BadRequest("Tipo de archivo no permitido. Solo se aceptan imágenes JPG, PNG, GIF o WEBP.");
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
                'relatedType' => 'CAmbassador',
                'relatedId'   => $embajadorId,
                'field'       => 'photo',
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

            // Actualizar photo_id del embajador
            $pdo = $entityManager->getPDO();
            $pdo->prepare("UPDATE c_ambassador SET photo_id = ?, modified_at = NOW() WHERE id = ?")
                ->execute([$attachmentId, $embajadorId]);

            $siteUrl = rtrim($this->getContainer()->get('config')->get('siteUrl', ''), '/');

            return [
                'success'  => true,
                'photoUrl' => $siteUrl . '/?entryPoint=image&id=' . $attachmentId
            ];

        } catch (BadRequest $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function postActionSubirDocumento($params, $data, $request)
    {
        try {
            $embajadorId = $request->get('embajadorId');
            if (!$embajadorId) {
                throw new BadRequest("ID de embajador no proporcionado");
            }

            if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
                throw new BadRequest("No se recibió ningún archivo o hubo un error de subida");
            }

            $file = $_FILES['file'];

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
                'relatedType' => 'CAmbassador',
                'relatedId'   => $embajadorId,
                'field'       => 'documentos',
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

            $siteUrl = rtrim($this->getContainer()->get('config')->get('siteUrl', ''), '/');

            return [
                'success' => true,
                'documento' => [
                    'id'   => $attachmentId,
                    'name' => $name,
                    'type' => $type,
                    'size' => $file['size'],
                    'url'  => $siteUrl . '/?entryPoint=download&id=' . $attachmentId
                ]
            ];

        } catch (BadRequest $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function postActionEliminarDocumento($params, $data, $request)
    {
        try {
            $body = $request->getParsedBody();
            if (is_object($body)) $body = (array) $body;

            $documentoId = $body['documentoId'] ?? null;
            if (!$documentoId) {
                return ['success' => false, 'error' => 'ID de documento no proporcionado'];
            }

            $entityManager = $this->getContainer()->get('entityManager');
            $attachment = $entityManager->getEntity('Attachment', $documentoId);

            if ($attachment) {
                $entityManager->removeEntity($attachment);
            }

            return ['success' => true];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function postActionCrearNota($params, $data, $request)
    {
        try {
            $body = $request->getParsedBody();
            if (is_object($body)) $body = (array) $body;

            $embajadorId = $body['embajadorId'] ?? null;
            $post        = trim($body['post'] ?? '');

            if (!$embajadorId || !$post) {
                return ['success' => false, 'error' => 'Datos incompletos'];
            }

            $currentUser = $this->getUser();
            $createdById = $currentUser->getId();

            $pdo     = $this->getContainer()->get('entityManager')->getPDO();
            $siteUrl = rtrim($this->getContainer()->get('config')->get('siteUrl', ''), '/');
            $noteId  = $this->generateId();
            $now     = date('Y-m-d H:i:s');

            $pdo->prepare("INSERT INTO note (id, post, data, type, created_at, modified_at, created_by_id, deleted)
                           VALUES (?, ?, '{}', 'Post', ?, ?, ?, 0)")
                ->execute([$noteId, $post, $now, $now, $createdById]);

            $pdo->prepare("INSERT INTO note_user (note_id, user_id, deleted) VALUES (?, ?, 0)")
                ->execute([$noteId, $embajadorId]);

            $sthAutor = $pdo->prepare(
                "SELECT first_name, last_name, avatar_id FROM user WHERE id = ? AND deleted = 0 LIMIT 1"
            );
            $sthAutor->execute([$createdById]);
            $autor = $sthAutor->fetch(\PDO::FETCH_ASSOC);

            $autorAvatar = null;
            if ($autor && $autor['avatar_id']) {
                $autorAvatar = $siteUrl . '/?entryPoint=image&id=' . $autor['avatar_id'];
            }

            return [
                'success' => true,
                'nota' => [
                    'id'          => $noteId,
                    'post'        => $post,
                    'createdAt'   => $now,
                    'autorNombre' => $autor
                        ? trim(($autor['first_name'] ?? '') . ' ' . ($autor['last_name'] ?? ''))
                        : 'Usuario',
                    'autorAvatar' => $autorAvatar
                ]
            ];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    private function getFotoFallback($pdo, $siteUrl)
    {
        try {
            $sql = "SELECT avatar_id FROM user WHERE user_name = '0' AND deleted = 0 LIMIT 1";
            $sth = $pdo->prepare($sql);
            $sth->execute();
            $row = $sth->fetch(\PDO::FETCH_ASSOC);

            if ($row && !empty($row['avatar_id'])) {
                return $siteUrl . '/?entryPoint=image&id=' . $row['avatar_id'];
            }
            return null;
        } catch (\Exception $e) {
            return null;
        }
    }

    private function getOficinaNameByUser($userId, $pdo)
    {
        if (!$userId) return '';
        try {
            $sql = "SELECT t.name
                    FROM team t
                    INNER JOIN team_user tu ON t.id = tu.team_id
                    WHERE tu.user_id = ?
                    AND t.id NOT LIKE 'CLA%'
                    AND LOWER(t.id) != 'venezuela'
                    AND tu.deleted = 0
                    AND t.deleted = 0
                    LIMIT 1";
            $sth = $pdo->prepare($sql);
            $sth->execute([$userId]);
            $row = $sth->fetch(\PDO::FETCH_ASSOC);
            return $row ? $row['name'] : '';
        } catch (\Exception $e) {
            return '';
        }
    }

    private function getOficinaIdByUser($userId, $pdo)
    {
        if (!$userId) return null;
        try {
            $sql = "SELECT t.id
                    FROM team t
                    INNER JOIN team_user tu ON t.id = tu.team_id
                    WHERE tu.user_id = ?
                    AND t.id NOT LIKE 'CLA%'
                    AND LOWER(t.id) != 'venezuela'
                    AND tu.deleted = 0
                    AND t.deleted = 0
                    LIMIT 1";
            $sth = $pdo->prepare($sql);
            $sth->execute([$userId]);
            $row = $sth->fetch(\PDO::FETCH_ASSOC);
            return $row ? $row['id'] : null;
        } catch (\Exception $e) {
            return null;
        }
    }

    private function getUserFullInfo($userId, $pdo)
    {
        try {
            $sql = "SELECT
                        u.id, u.type,
                        GROUP_CONCAT(DISTINCT LOWER(r.name)) as roles,
                        GROUP_CONCAT(DISTINCT t.id) as team_ids
                    FROM user u
                    LEFT JOIN role_user ru ON u.id = ru.user_id AND ru.deleted = 0
                    LEFT JOIN role r ON ru.role_id = r.id AND r.deleted = 0
                    LEFT JOIN team_user tu ON u.id = tu.user_id AND tu.deleted = 0
                    LEFT JOIN team t ON tu.team_id = t.id AND t.deleted = 0
                    WHERE u.id = ? AND u.deleted = 0
                    GROUP BY u.id LIMIT 1";

            $sth = $pdo->prepare($sql);
            $sth->execute([$userId]);
            $row = $sth->fetch(\PDO::FETCH_ASSOC);
            if (!$row) return null;

            $roles   = $row['roles']    ? explode(',', $row['roles'])    : [];
            $teamIds = $row['team_ids'] ? explode(',', $row['team_ids']) : [];

            $claId    = null;
            $oficina  = null;
            $claRegex = '/^CLA\d+$/i';

            foreach ($teamIds as $tid) {
                if (preg_match($claRegex, $tid)) {
                    $claId = $tid;
                } elseif (!$oficina && strtolower($tid) !== 'venezuela') {
                    $oficina = $tid;
                }
            }

            return [
                'esCasaNacional' => in_array('casa nacional', $roles),
                'esGerente'      => in_array('gerente', $roles),
                'esDirector'     => in_array('director', $roles),
                'esCoordinador'  => in_array('coordinador', $roles),
                'claId'          => $claId,
                'oficinaId'      => $oficina
            ];
        } catch (\Exception $e) {
            return null;
        }
    }

    private function generateId()
    {
        return substr(str_replace(['+', '/', '='], '', base64_encode(random_bytes(16))), 0, 17);
    }
}