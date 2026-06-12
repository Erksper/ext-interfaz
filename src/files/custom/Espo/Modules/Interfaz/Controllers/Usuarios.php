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
                        u.email_address as emailAddress,
                        u.phone_number as phoneNumber,
                        GROUP_CONCAT(DISTINCT LOWER(r.name)) as roles
                    FROM user u
                    LEFT JOIN role_user ru ON u.id = ru.user_id AND ru.deleted = 0
                    LEFT JOIN role r ON ru.role_id = r.id AND r.deleted = 0
                    LEFT JOIN team_user tu ON u.id = tu.user_id AND tu.deleted = 0
                    LEFT JOIN team t ON tu.team_id = t.id AND t.deleted = 0
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