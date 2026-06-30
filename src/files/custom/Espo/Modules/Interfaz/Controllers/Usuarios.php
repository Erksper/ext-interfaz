<?php
namespace Espo\Modules\Interfaz\Controllers;

use Espo\Core\Exceptions\BadRequest;
use Espo\Core\Exceptions\Error;
use Espo\Core\Exceptions\Forbidden;

class Usuarios extends \Espo\Core\Controllers\Record
{
    public function getActionGetUserInfo($params, $data, $request)
    {
        try {
            $user = $this->getContainer()->get('user');
            $userId = $user->get('id');
            
            $userInfo = $this->getUserFullInfo($userId);
            
            if (!$userInfo) {
                return [
                    'success' => false,
                    'error' => 'Usuario no encontrado'
                ];
            }
            
            return [
                'success' => true,
                'data' => [
                    'esAdmin' => $user->isAdmin(),
                    'esCasaNacional' => $this->hasRole($userInfo, 'casa nacional'),
                    'claUsuario' => $userInfo['claId'],
                    'oficinaUsuario' => $userInfo['oficinaId'],
                    'userId' => $userId,
                    'roles' => $userInfo['roles']
                ]
            ];
            
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
    
    public function getActionGetCLAs($params, $data, $request)
    {
        try {
            $entityManager = $this->getContainer()->get('entityManager');
            $pdo = $entityManager->getPDO();
            
            $sql = "SELECT id, name 
                    FROM team 
                    WHERE id LIKE 'CLA%' 
                    AND deleted = 0 
                    ORDER BY name";
            
            $sth = $pdo->prepare($sql);
            $sth->execute();
            
            $clas = [];
            while ($row = $sth->fetch(\PDO::FETCH_ASSOC)) {
                $clas[] = [
                    'id' => $row['id'],
                    'name' => $row['name']
                ];
            }
            
            return [
                'success' => true,
                'data' => $clas
            ];
            
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
    
    public function getActionGetOficinasByCLA($params, $data, $request)
    {
        try {
            $claId = $request->get('claId');
            
            if (!$claId) {
                return [
                    'success' => false,
                    'error' => 'ID de CLA no proporcionado'
                ];
            }
            
            $entityManager = $this->getContainer()->get('entityManager');
            $pdo = $entityManager->getPDO();
            
            // Obtener usuarios del CLA
            $sqlUsuarios = "SELECT DISTINCT user_id 
                            FROM team_user 
                            WHERE team_id = :claId 
                            AND deleted = 0";
            
            $sthUsuarios = $pdo->prepare($sqlUsuarios);
            $sthUsuarios->bindValue(':claId', $claId);
            $sthUsuarios->execute();
            
            $usuariosDelCLA = [];
            while ($row = $sthUsuarios->fetch(\PDO::FETCH_ASSOC)) {
                $usuariosDelCLA[] = $row['user_id'];
            }
            
            if (empty($usuariosDelCLA)) {
                return [
                    'success' => true,
                    'data' => []
                ];
            }
            
            // Obtener oficinas de esos usuarios
            $placeholders = implode(',', array_fill(0, count($usuariosDelCLA), '?'));
            
            $sqlOficinas = "SELECT DISTINCT tu.team_id, t.name
                            FROM team_user tu
                            INNER JOIN team t ON tu.team_id = t.id
                            WHERE tu.user_id IN ($placeholders)
                            AND t.id NOT LIKE 'CLA%'
                            AND t.id != 'venezuela'
                            AND LOWER(t.name) != 'venezuela'
                            AND tu.deleted = 0
                            AND t.deleted = 0
                            ORDER BY t.name";
            
            $sthOficinas = $pdo->prepare($sqlOficinas);
            $sthOficinas->execute($usuariosDelCLA);
            
            $oficinas = [];
            while ($row = $sthOficinas->fetch(\PDO::FETCH_ASSOC)) {
                $oficinas[] = [
                    'id' => $row['team_id'],
                    'name' => $row['name']
                ];
            }
            
            return [
                'success' => true,
                'data' => $oficinas
            ];
            
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'data' => []
            ];
        }
    }
    
    public function getActionGetListaUsuarios($params, $data, $request)
    {
        try {
            $entityManager = $this->getContainer()->get('entityManager');
            $user = $this->getContainer()->get('user');
            $userInfo = $this->getUserFullInfo($user->get('id'));
            
            if (!$userInfo) {
                throw new Error("No se pudo obtener información del usuario");
            }
            
            // Parámetros de paginación
            $pagina = (int)$request->get('pagina', 1);
            $porPagina = (int)$request->get('porPagina', 25);
            $offset = ($pagina - 1) * $porPagina;
            
            // Filtros
            $claId = $request->get('claId');
            $oficinaId = $request->get('oficinaId');
            $rol = $request->get('rol');
            $tipo = $request->get('tipo');
            $estado = $request->get('estado');
            
            // Construir query base
            $sql = "SELECT DISTINCT 
                        u.id,
                        u.user_name,
                        u.first_name,
                        u.last_name,
                        u.type,
                        u.is_active,
                        ea.lower as emailAddress,
                        pn.numeric as phoneNumber,
                        GROUP_CONCAT(DISTINCT LOWER(r.name)) as roles
                    FROM user u
                    LEFT JOIN role_user ru ON u.id = ru.user_id AND ru.deleted = 0
                    LEFT JOIN role r ON ru.role_id = r.id AND r.deleted = 0
                    LEFT JOIN team_user tu ON u.id = tu.user_id AND tu.deleted = 0
                    LEFT JOIN team t ON tu.team_id = t.id AND t.deleted = 0
                    LEFT JOIN entity_email_address eea 
                        ON eea.entity_id = u.id 
                        AND eea.entity_type = 'User' 
                        AND eea.primary = 1 
                        AND eea.deleted = 0
                    LEFT JOIN email_address ea 
                        ON ea.id = eea.email_address_id 
                        AND ea.deleted = 0
                    LEFT JOIN entity_phone_number epn 
                        ON epn.entity_id = u.id 
                        AND epn.entity_type = 'User' 
                        AND epn.primary = 1 
                        AND epn.deleted = 0
                    LEFT JOIN phone_number pn 
                        ON pn.id = epn.phone_number_id 
                        AND pn.deleted = 0
                    WHERE u.deleted = 0";
            
            $params = [];
            
            // Restricciones por permisos del usuario logueado
            $esAdmin = $user->isAdmin();
            $esCasaNacional = $this->hasRole($userInfo, 'casa nacional');
            
            if (!$esAdmin && !$esCasaNacional) {
                // Usuario regular: solo puede ver usuarios de su oficina o él mismo
                $oficinaUsuario = $userInfo['oficinaId'];
                $userId = $user->get('id');
                
                if ($oficinaUsuario) {
                    $sql .= " AND (tu.team_id = :oficinaUsuario OR u.id = :userId)";
                    $params[':oficinaUsuario'] = $oficinaUsuario;
                    $params[':userId'] = $userId;
                } else {
                    $sql .= " AND u.id = :userId";
                    $params[':userId'] = $userId;
                }
            }
            
            // Aplicar filtros
            if ($claId) {
                $sql .= " AND t.id = :claId";
                $params[':claId'] = $claId;
            }
            
            if ($oficinaId) {
                $sql .= " AND tu.team_id = :oficinaId";
                $params[':oficinaId'] = $oficinaId;
            }
            
            if ($rol) {
                $sql .= " AND LOWER(r.name) = :rol";
                $params[':rol'] = strtolower($rol);
            }
            
            if ($tipo) {
                $sql .= " AND u.type = :tipo";
                $params[':tipo'] = $tipo;
            }
            
            if ($estado !== null && $estado !== '') {
                $sql .= " AND u.is_active = :estado";
                $params[':estado'] = (int)$estado;
            }
            
            $sql .= " GROUP BY u.id ORDER BY u.first_name, u.last_name, u.user_name";
            
            // Query para contar total
            $sqlCount = preg_replace('/ORDER BY.*/', '', $sql);
            $sqlCount = str_replace('GROUP BY u.id', '', $sqlCount);
            $sqlCount = "SELECT COUNT(*) as total FROM (" . $sqlCount . ") as subquery";
            
            $pdo = $entityManager->getPDO();
            
            // Obtener total
            $sthCount = $pdo->prepare($sqlCount);
            foreach ($params as $key => $value) {
                $sthCount->bindValue($key, $value);
            }
            $sthCount->execute();
            $total = $sthCount->fetch(\PDO::FETCH_ASSOC)['total'];
            
            // Agregar paginación
            $sql .= " LIMIT :offset, :limit";
            $params[':offset'] = $offset;
            $params[':limit'] = $porPagina;
            
            $sth = $pdo->prepare($sql);
            foreach ($params as $key => $value) {
                if ($key === ':offset' || $key === ':limit') {
                    $sth->bindValue($key, (int)$value, \PDO::PARAM_INT);
                } else {
                    $sth->bindValue($key, $value);
                }
            }
            $sth->execute();
            
            $usuarios = [];
            while ($row = $sth->fetch(\PDO::FETCH_ASSOC)) {
                // Obtener avatar URL
                $avatarUrl = $this->getAvatarUrl($row['id'], $entityManager);
                
                // Determinar el rol principal
                $rolesList = $row['roles'] ? explode(',', $row['roles']) : [];
                $rolPrincipal = !empty($rolesList) ? ucfirst($rolesList[0]) : ($row['type'] === 'admin' ? 'Administrador' : 'Usuario');
                
                $usuarios[] = [
                    'id' => $row['id'],
                    'userName' => $row['user_name'],
                    'firstName' => $row['first_name'],
                    'lastName' => $row['last_name'],
                    'type' => $row['type'],
                    'isActive' => $row['is_active'],
                    'emailAddress' => $row['emailAddress'],
                    'phoneNumber' => $row['phoneNumber'],
                    'rol' => $rolPrincipal,
                    'avatarUrl' => $avatarUrl
                ];
            }
            
            return [
                'success' => true,
                'data' => $usuarios,
                'total' => (int)$total,
                'pagina' => $pagina,
                'porPagina' => $porPagina,
                'totalPaginas' => ceil($total / $porPagina)
            ];
            
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'data' => []
            ];
        }
    }

    public function postActionCrearNota($params, $data, $request)
    {
        try {
            $body = $request->getParsedBody();
            if (is_object($body)) $body = (array) $body;

            $targetUserId = $body['userId'] ?? null;
            $post         = trim($body['post'] ?? '');

            if (!$targetUserId || !$post) {
                return ['success' => false, 'error' => 'Datos incompletos'];
            }

            $currentUser = $this->getUser();
            $createdById = $currentUser->getId();

            $entityManager = $this->getContainer()->get('entityManager');
            $pdo = $entityManager->getPDO();

            $noteId = $this->generateId();
            $now = date('Y-m-d H:i:s');

            $pdo->prepare("INSERT INTO note (id, post, data, type, created_at, modified_at, created_by_id, deleted)
                        VALUES (?, ?, '{}', 'Post', ?, ?, ?, 0)")
                ->execute([$noteId, $post, $now, $now, $createdById]);

            $pdo->prepare("INSERT INTO note_user (note_id, user_id, deleted)
                        VALUES (?, ?, 0)")
                ->execute([$noteId, $targetUserId]);

            // Retornar la nota creada con datos del autor
            $sqlAutor = "SELECT first_name, last_name, avatar_id FROM user WHERE id = ? AND deleted = 0 LIMIT 1";
            $sthAutor = $pdo->prepare($sqlAutor);
            $sthAutor->execute([$createdById]);
            $autor = $sthAutor->fetch(\PDO::FETCH_ASSOC);

            $autorAvatar = null;
            if ($autor && $autor['avatar_id']) {
                $autorAvatar = '?entryPoint=image&id=' . $autor['avatar_id'];
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

    public function getActionGetPerfilUsuario($params, $data, $request)
    {
        try {
            $targetUserId = $request->get('userId');
            if (!$targetUserId) {
                return ['success' => false, 'error' => 'ID de usuario no proporcionado'];
            }

            $entityManager = $this->getContainer()->get('entityManager');
            $pdo = $entityManager->getPDO();
            $siteUrl = rtrim($this->getContainer()->get('config')->get('siteUrl', ''), '/');

            $sql = "SELECT 
                        u.id,
                        u.user_name,
                        u.first_name,
                        u.last_name,
                        u.type,
                        u.is_active,
                        u.title,
                        u.gender,
                        u.avatar_id,
                        u.default_team_id,
                        u.c_foto,
                        u.c_fotop_id,
                        u.c_descripcionperfil,
                        u.c_qr,
                        u.c_u_r_l_perfil,
                        u.c_carnet,
                        u.c_tipode_carnet,
                        ea.lower as emailAddress,
                        pn.numeric as phoneNumber
                    FROM user u
                    LEFT JOIN entity_email_address eea 
                        ON eea.entity_id = u.id 
                        AND eea.entity_type = 'User' 
                        AND eea.primary = 1 
                        AND eea.deleted = 0
                    LEFT JOIN email_address ea 
                        ON ea.id = eea.email_address_id 
                        AND ea.deleted = 0
                    LEFT JOIN entity_phone_number epn 
                        ON epn.entity_id = u.id 
                        AND epn.entity_type = 'User' 
                        AND epn.primary = 1 
                        AND epn.deleted = 0
                    LEFT JOIN phone_number pn 
                        ON pn.id = epn.phone_number_id 
                        AND pn.deleted = 0
                    WHERE u.id = ?
                    AND u.deleted = 0
                    LIMIT 1";

            $sth = $pdo->prepare($sql);
            $sth->execute([$targetUserId]);
            $userData = $sth->fetch(\PDO::FETCH_ASSOC);

            if (!$userData) {
                return ['success' => false, 'error' => 'Usuario no encontrado'];
            }

            // Equipos del usuario
            $sqlTeams = "SELECT t.id, t.name
                        FROM team t
                        INNER JOIN team_user tu ON t.id = tu.team_id
                        WHERE tu.user_id = ?
                        AND tu.deleted = 0
                        AND t.deleted = 0
                        ORDER BY t.name";
            $sthTeams = $pdo->prepare($sqlTeams);
            $sthTeams->execute([$targetUserId]);
            $teams = [];
            while ($row = $sthTeams->fetch(\PDO::FETCH_ASSOC)) {
                $teams[] = ['id' => $row['id'], 'name' => $row['name']];
            }

            // Equipo por defecto
            $defaultTeamName = '';
            if ($userData['default_team_id']) {
                $sqlDT = "SELECT name FROM team WHERE id = ? AND deleted = 0 LIMIT 1";
                $sthDT = $pdo->prepare($sqlDT);
                $sthDT->execute([$userData['default_team_id']]);
                $dtRow = $sthDT->fetch(\PDO::FETCH_ASSOC);
                $defaultTeamName = $dtRow ? $dtRow['name'] : '';
            }

            // Roles del usuario
            $sqlRoles = "SELECT r.id, r.name
                        FROM role r
                        INNER JOIN role_user ru ON r.id = ru.role_id
                        WHERE ru.user_id = ?
                        AND ru.deleted = 0
                        AND r.deleted = 0
                        ORDER BY r.name";
            $sthRoles = $pdo->prepare($sqlRoles);
            $sthRoles->execute([$targetUserId]);
            $roles = [];
            while ($row = $sthRoles->fetch(\PDO::FETCH_ASSOC)) {
                $roles[] = ['id' => $row['id'], 'name' => $row['name']];
            }

            // Avatar — usar c_fotop_id como attachment
            $avatarUrl = null;
            if (!empty($userData['c_fotop_id'])) {
                $avatarUrl = $siteUrl . '/?entryPoint=image&id=' . $userData['c_fotop_id'];
            } elseif (!empty($userData['avatar_id'])) {
                $avatarUrl = $siteUrl . '/?entryPoint=image&id=' . $userData['avatar_id'];
            }

            // QR — URL absoluta con siteUrl y el id hash de EspoCRM
            $qrImageUrl = null;
            if (!empty($userData['c_qr'])) {
                $qrImageUrl = $siteUrl . '/?entryPoint=qrCode&userId=' . $targetUserId;
            }

            // Observaciones (posts)
            $sqlNotes = "SELECT 
                            n.id,
                            n.post,
                            n.created_at,
                            n.created_by_id,
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
            $sthNotes->execute([$targetUserId]);
            $notas = [];
            while ($row = $sthNotes->fetch(\PDO::FETCH_ASSOC)) {
                $autorAvatar = null;
                if ($row['autor_avatar_id']) {
                    $autorAvatar = $siteUrl . '/?entryPoint=image&id=' . $row['autor_avatar_id'];
                }
                $notas[] = [
                    'id'          => $row['id'],
                    'post'        => $row['post'],
                    'createdAt'   => $row['created_at'],
                    'autorNombre' => trim($row['autor_nombre']) ?: 'Usuario',
                    'autorAvatar' => $autorAvatar
                ];
            }

            // Tipo de carnet legible
            $tipoCarnetMap = ['1' => 'Asesor', '2' => 'Asesor Certificado'];
            $tipoCarnet = $tipoCarnetMap[$userData['c_tipode_carnet'] ?? ''] ?? '';

            return [
                'success' => true,
                'data' => [
                    'id'                => $userData['id'],
                    'userName'          => $userData['user_name'],
                    'firstName'         => $userData['first_name'],
                    'lastName'          => $userData['last_name'],
                    'type'              => $userData['type'],
                    'isActive'          => $userData['is_active'],
                    'title'             => $userData['title'],
                    'gender'            => $userData['gender'],
                    'emailAddress'      => $userData['emailAddress'],
                    'phoneNumber'       => $userData['phoneNumber'],
                    'descripcionPerfil' => $userData['c_descripcionperfil'],
                    'urlPerfil'         => $userData['c_u_r_l_perfil'],
                    'qr'                => $userData['c_qr'],
                    'qrImageUrl'        => $qrImageUrl,
                    'carnet'            => $userData['c_carnet'],
                    'tipoCarnet'        => $tipoCarnet,
                    'tipoCarnetVal'     => $userData['c_tipode_carnet'],
                    'avatarUrl'         => $avatarUrl,
                    'fotoExterna'       => null,
                    'fotoEditable'      => empty($userData['c_fotop_id']),
                    'defaultTeamId'     => $userData['default_team_id'],
                    'defaultTeamName'   => $defaultTeamName,
                    'teams'             => $teams,
                    'roles'             => $roles,
                    'notas'             => $notas
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

            if ($row && $row['avatar_id']) {
                return $siteUrl . '/?entryPoint=image&id=' . $row['avatar_id'];
            }
            return null;
        } catch (\Exception $e) {
            return null;
        }
    }

    public function getActionGetAsesoresPorOficina($params, $data, $request)
    {
        try {
            $oficinaId = $request->get('oficinaId');
            if (!$oficinaId) {
                return ['success' => false, 'error' => 'ID de oficina no proporcionado'];
            }

            $pdo = $this->getContainer()->get('entityManager')->getPDO();

            $sql = "SELECT DISTINCT u.id,
                        CONCAT(u.first_name, ' ', u.last_name) as name
                    FROM user u
                    INNER JOIN team_user tu ON u.id = tu.user_id
                    WHERE tu.team_id = ?
                    AND tu.deleted = 0
                    AND u.deleted = 0
                    AND u.is_active = 1
                    ORDER BY name";

            $sth = $pdo->prepare($sql);
            $sth->execute([$oficinaId]);

            $asesores = [];
            while ($row = $sth->fetch(\PDO::FETCH_ASSOC)) {
                $asesores[] = [
                    'id'   => $row['id'],
                    'name' => trim($row['name'])
                ];
            }

            return ['success' => true, 'data' => $asesores];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function postActionGuardarCampo($params, $data, $request)
    {
        try {
            $body = $request->getParsedBody();
            if (is_object($body)) $body = (array) $body;

            $targetUserId = $body['userId'] ?? null;
            $campo        = $body['campo'] ?? null;
            $valor        = $body['valor'] ?? null;

            if (!$targetUserId || !$campo) {
                return ['success' => false, 'error' => 'Datos incompletos'];
            }

            // Campos permitidos para edición
            $camposPermitidos = [
                'first_name', 'last_name', 'title', 'gender',
                'c_descripcionperfil', 'c_tipode_carnet'
            ];

            if (!in_array($campo, $camposPermitidos)) {
                return ['success' => false, 'error' => 'Campo no editable'];
            }

            $entityManager = $this->getContainer()->get('entityManager');
            $pdo = $entityManager->getPDO();

            $sql = "UPDATE user SET {$campo} = ?, modified_at = NOW() WHERE id = ? AND deleted = 0";
            $sth = $pdo->prepare($sql);
            $sth->execute([$valor, $targetUserId]);

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

            $targetUserId = $body['userId'] ?? null;
            $email        = $body['valor'] ?? null;

            if (!$targetUserId || !$email) {
                return ['success' => false, 'error' => 'Datos incompletos'];
            }

            $entityManager = $this->getContainer()->get('entityManager');
            $pdo = $entityManager->getPDO();

            // Verificar si ya tiene email
            $sqlCheck = "SELECT ea.id 
                        FROM email_address ea
                        INNER JOIN entity_email_address eea ON ea.id = eea.email_address_id
                        WHERE eea.entity_id = ?
                        AND eea.entity_type = 'User'
                        AND eea.primary = 1
                        AND eea.deleted = 0
                        AND ea.deleted = 0
                        LIMIT 1";
            $sthCheck = $pdo->prepare($sqlCheck);
            $sthCheck->execute([$targetUserId]);
            $existing = $sthCheck->fetch(\PDO::FETCH_ASSOC);

            if ($existing) {
                $sql = "UPDATE email_address SET lower = ?, name = ?, modified_at = NOW() WHERE id = ?";
                $pdo->prepare($sql)->execute([strtolower($email), $email, $existing['id']]);
            } else {
                $newId = $this->generateId();
                $pdo->prepare("INSERT INTO email_address (id, lower, name) VALUES (?, ?, ?)")
                    ->execute([$newId, strtolower($email), $email]);
                $pdo->prepare("INSERT INTO entity_email_address (entity_id, entity_type, email_address_id, `primary`) VALUES (?, 'User', ?, 1)")
                    ->execute([$targetUserId, $newId]);
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

            $targetUserId = $body['userId'] ?? null;
            $telefono     = $body['valor'] ?? null;

            if (!$targetUserId || !$telefono) {
                return ['success' => false, 'error' => 'Datos incompletos'];
            }

            $entityManager = $this->getContainer()->get('entityManager');
            $pdo = $entityManager->getPDO();

            $sqlCheck = "SELECT pn.id 
                        FROM phone_number pn
                        INNER JOIN entity_phone_number epn ON pn.id = epn.phone_number_id
                        WHERE epn.entity_id = ?
                        AND epn.entity_type = 'User'
                        AND epn.primary = 1
                        AND epn.deleted = 0
                        AND pn.deleted = 0
                        LIMIT 1";
            $sthCheck = $pdo->prepare($sqlCheck);
            $sthCheck->execute([$targetUserId]);
            $existing = $sthCheck->fetch(\PDO::FETCH_ASSOC);

            if ($existing) {
                $pdo->prepare("UPDATE phone_number SET numeric = ?, name = ?, modified_at = NOW() WHERE id = ?")
                    ->execute([$telefono, $telefono, $existing['id']]);
            } else {
                $newId = $this->generateId();
                $pdo->prepare("INSERT INTO phone_number (id, numeric, name) VALUES (?, ?, ?)")
                    ->execute([$newId, $telefono, $telefono]);
                $pdo->prepare("INSERT INTO entity_phone_number (entity_id, entity_type, phone_number_id, `primary`) VALUES (?, 'User', ?, 1)")
                    ->execute([$targetUserId, $newId]);
            }

            return ['success' => true];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    private function generateId()
    {
        return substr(str_replace(['+', '/', '='], '', base64_encode(random_bytes(16))), 0, 17);
    }
    
    private function getAvatarUrl($userId, $entityManager)
    {
        try {
            $pdo = $entityManager->getPDO();
            
            $sql = "SELECT a.id 
                    FROM attachment a 
                    INNER JOIN user u ON u.avatar_id = a.id 
                    WHERE u.id = :userId 
                    AND u.deleted = 0 
                    LIMIT 1";
            
            $sth = $pdo->prepare($sql);
            $sth->bindValue(':userId', $userId);
            $sth->execute();
            
            $row = $sth->fetch(\PDO::FETCH_ASSOC);
            
            if ($row) {
                return '?entryPoint=download&id=' . $row['id'];
            }
            
            return null;
            
        } catch (\Exception $e) {
            return null;
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
                        u.type,
                        GROUP_CONCAT(DISTINCT LOWER(r.name)) as roles,
                        GROUP_CONCAT(DISTINCT t.id) as team_ids
                    FROM user u
                    LEFT JOIN role_user ru ON u.id = ru.user_id AND ru.deleted = 0
                    LEFT JOIN role r ON ru.role_id = r.id AND r.deleted = 0
                    LEFT JOIN team_user tu ON u.id = tu.user_id AND tu.deleted = 0
                    LEFT JOIN team t ON tu.team_id = t.id AND t.deleted = 0
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
            $teamIds = $userData['team_ids'] ? explode(',', $userData['team_ids']) : [];
            
            // Determinar CLA del usuario
            $claId = null;
            $claPattern = '/^CLA\d+$/i';
            foreach ($teamIds as $teamId) {
                if (preg_match($claPattern, $teamId)) {
                    $claId = $teamId;
                    break;
                }
            }
            
            // Determinar oficina del usuario
            $oficinaId = null;
            foreach ($teamIds as $teamId) {
                if (!preg_match($claPattern, $teamId) && 
                    strtolower($teamId) !== 'venezuela') {
                    $oficinaId = $teamId;
                    break;
                }
            }
            
            return [
                'id' => $userId,
                'type' => $userData['type'],
                'roles' => $roles,
                'teamIds' => $teamIds,
                'claId' => $claId,
                'oficinaId' => $oficinaId
            ];
            
        } catch (\Exception $e) {
            return null;
        }
    }
}