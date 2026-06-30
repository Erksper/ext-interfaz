<?php
namespace Espo\Modules\Interfaz\Controllers;

use Espo\Core\Exceptions\Error;
use Espo\Core\Exceptions\BadRequest;

class Leads extends \Espo\Core\Controllers\Record
{
    private $stageMap = [
        'Prospecting'                       => 'Por Contactar',
        'Proposed'                          => 'Recopilacion de informacion',
        'Presented'                         => 'Creacion de Perfil de compra',
        'Recopilacion de opciones'          => 'Recopilacion de opciones',
        'Muesta de Opciones'                => 'Muesta de Opciones',
        'Visita de propiedad'               => 'Visita de propiedad',
        'Propuesta por parte del comprador' => 'Propuesta por parte del comprador',
        'Aceptacion de propuesta'           => 'Aceptacion de propuesta',
        'Por cobrar'                        => 'Por cobrar',
        'Closed Won'                        => 'Cerrado Ganado',
        'Closed Lost'                       => 'Cerrado Perdido'
    ];

    private $stageOrder = [
        'Prospecting',
        'Proposed',
        'Presented',
        'Recopilacion de opciones',
        'Muesta de Opciones',
        'Visita de propiedad',
        'Propuesta por parte del comprador',
        'Aceptacion de propuesta',
        'Por cobrar',
        'Closed Won',
        'Closed Lost'
    ];

    public function getActionGetLista($params, $data, $request)
    {
        try {
            $entityManager = $this->getContainer()->get('entityManager');
            $user          = $this->getContainer()->get('user');
            $pdo           = $entityManager->getPDO();

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
            $interes   = $request->get('interes');
            $stage     = $request->get('stage');

            list($sql, $params) = $this->buildBaseQuery(
                $user, $userInfo, $pdo, $claId, $oficinaId, $asesorId, $interes, $stage
            );

            $sql .= " ORDER BY o.created_at DESC";

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

            $leads = [];
            while ($row = $sth->fetch(\PDO::FETCH_ASSOC)) {
                $leads[] = $this->formatLeadRow($row);
            }

            return [
                'success'      => true,
                'data'         => $leads,
                'total'        => $total,
                'pagina'       => $pagina,
                'porPagina'    => $porPagina,
                'totalPaginas' => (int)ceil($total / $porPagina)
            ];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage(), 'data' => []];
        }
    }

    public function getActionGetKanban($params, $data, $request)
    {
        try {
            $entityManager = $this->getContainer()->get('entityManager');
            $user          = $this->getContainer()->get('user');
            $pdo           = $entityManager->getPDO();

            $userInfo = $this->getUserFullInfo($user->get('id'), $pdo);
            if (!$userInfo) {
                throw new Error("No se pudo obtener información del usuario");
            }

            $claId     = $request->get('claId');
            $oficinaId = $request->get('oficinaId');
            $asesorId  = $request->get('asesorId');
            $interes   = $request->get('interes');
            $stage     = $request->get('stage');

            $porColumna = (int)$request->get('porColumna', 25);
            $paginas    = $request->get('paginas'); // JSON: {"Prospecting": 1, "Proposed": 2, ...}
            $paginasMap = [];
            if ($paginas) {
                $decoded = json_decode($paginas, true);
                if (is_array($decoded)) $paginasMap = $decoded;
            }

            $columnas = [];

            foreach ($this->stageOrder as $stageValue) {
                // Si se filtró por un stage específico y no es este, lo saltamos
                if ($stage && $stage !== $stageValue) {
                    continue;
                }

                $paginaCol = isset($paginasMap[$stageValue]) ? (int)$paginasMap[$stageValue] : 1;
                $offsetCol = ($paginaCol - 1) * $porColumna;

                list($sql, $sqlParams) = $this->buildBaseQuery(
                    $user, $userInfo, $pdo, $claId, $oficinaId, $asesorId, $interes, $stageValue
                );

                $sqlCount = "SELECT COUNT(*) as total FROM (" . $sql . ") as sub";
                $sthCount = $pdo->prepare($sqlCount);
                foreach ($sqlParams as $k => $v) {
                    $sthCount->bindValue($k, $v);
                }
                $sthCount->execute();
                $totalCol = (int)$sthCount->fetch(\PDO::FETCH_ASSOC)['total'];

                $sql .= " ORDER BY o.created_at DESC LIMIT :offset, :limit";
                $sth = $pdo->prepare($sql);
                foreach ($sqlParams as $k => $v) {
                    $sth->bindValue($k, $v);
                }
                $sth->bindValue(':offset', $offsetCol, \PDO::PARAM_INT);
                $sth->bindValue(':limit',  $porColumna, \PDO::PARAM_INT);
                $sth->execute();

                $items = [];
                while ($row = $sth->fetch(\PDO::FETCH_ASSOC)) {
                    $items[] = $this->formatLeadRow($row);
                }

                $columnas[] = [
                    'stage'        => $stageValue,
                    'stageLabel'   => $this->stageMap[$stageValue] ?? $stageValue,
                    'items'        => $items,
                    'total'        => $totalCol,
                    'pagina'       => $paginaCol,
                    'totalPaginas' => (int)ceil($totalCol / $porColumna)
                ];
            }

            return [
                'success' => true,
                'data'    => $columnas
            ];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage(), 'data' => []];
        }
    }

    private function buildBaseQuery($user, $userInfo, $pdo, $claId, $oficinaId, $asesorId, $interes, $stage)
    {
        $sql = "SELECT DISTINCT
                    o.id,
                    o.name,
                    o.description,
                    o.stage,
                    o.c_interes,
                    o.created_at,
                    o.assigned_user_id,
                    CONCAT(u.first_name, ' ', u.last_name) as assigned_user_name
                FROM opportunity o
                LEFT JOIN user u ON o.assigned_user_id = u.id AND u.deleted = 0
                LEFT JOIN team_user tu
                    ON tu.user_id = o.assigned_user_id
                    AND tu.deleted = 0
                LEFT JOIN team t
                    ON t.id = tu.team_id
                    AND t.deleted = 0
                    AND t.id NOT LIKE 'CLA%'
                    AND LOWER(t.id) != 'venezuela'
                WHERE o.deleted = 0";

        $params = [];

        $esAdmin   = $user->isAdmin();
        $esCN      = $esAdmin || $userInfo['esCasaNacional'];
        $esGestion = $userInfo['esGerente'] || $userInfo['esDirector'] || $userInfo['esCoordinador'];

        if (!$esCN && !$esGestion) {
            $sql .= " AND o.assigned_user_id = :userId";
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
            $sql .= " AND o.assigned_user_id = :asesorId";
            $params[':asesorId'] = $asesorId;
        }

        if ($interes) {
            $sql .= " AND o.c_interes = :interes";
            $params[':interes'] = $interes;
        }

        if ($stage) {
            $sql .= " AND o.stage = :stage";
            $params[':stage'] = $stage;
        }

        return [$sql, $params];
    }

    private function formatLeadRow($row)
    {
        $stageValue = $row['stage'];
        $stageLabel = $this->stageMap[$stageValue] ?? $stageValue;

        return [
            'id'               => $row['id'],
            'name'             => $row['name'],
            'description'      => $row['description'],
            'stage'            => $stageValue,
            'stageLabel'       => $stageLabel,
            'cInteres'         => $row['c_interes'],
            'createdAt'        => $row['created_at'],
            'assignedUserId'   => $row['assigned_user_id'],
            'assignedUserName' => trim($row['assigned_user_name'] ?? '')
        ];
    }

    public function getActionGetDetalle($params, $data, $request)
    {
        try {
            $leadId = $request->get('leadId');
            if (!$leadId) {
                return ['success' => false, 'error' => 'ID no proporcionado'];
            }

            $entityManager = $this->getContainer()->get('entityManager');
            $pdo           = $entityManager->getPDO();
            $siteUrl       = rtrim($this->getContainer()->get('config')->get('siteUrl', ''), '/');

            $sql = "SELECT
                        o.id,
                        o.name,
                        o.description,
                        o.stage,
                        o.c_interes,
                        o.c_nmero_de_contacto,
                        o.c_correo,
                        o.c_codigo,
                        o.amount,
                        o.amount_currency,
                        o.probability,
                        o.lead_source,
                        o.close_date,
                        o.created_at,
                        o.assigned_user_id,
                        o.c_ambassador_id,
                        CONCAT(u.first_name, ' ', u.last_name) as assigned_user_name,
                        u.avatar_id as assigned_user_avatar_id,
                        CONCAT(amb.first_name, ' ', amb.last_name) as ambassador_name
                    FROM opportunity o
                    LEFT JOIN user u ON o.assigned_user_id = u.id AND u.deleted = 0
                    LEFT JOIN c_ambassador amb ON o.c_ambassador_id = amb.id AND amb.deleted = 0
                    WHERE o.id = ?
                    AND o.deleted = 0
                    LIMIT 1";

            $sth = $pdo->prepare($sql);
            $sth->execute([$leadId]);
            $row = $sth->fetch(\PDO::FETCH_ASSOC);

            if (!$row) {
                return ['success' => false, 'error' => 'Lead no encontrado'];
            }

            $stageValue = $row['stage'];
            $stageLabel = $this->stageMap[$stageValue] ?? $stageValue;

            $teamName = $this->getOficinaNameByUser($row['assigned_user_id'], $pdo);

            $assignedUserAvatar = null;
            if ($row['assigned_user_avatar_id']) {
                $assignedUserAvatar = $siteUrl . '/?entryPoint=image&id=' . $row['assigned_user_avatar_id'];
            }

            // Observaciones (posts) — mismo sistema note/note_user
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
            $sthNotes->execute([$leadId]);
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

            return [
                'success' => true,
                'data' => [
                    'id'                  => $row['id'],
                    'name'                => $row['name'],
                    'description'         => $row['description'],
                    'stage'               => $stageValue,
                    'stageLabel'          => $stageLabel,
                    'cInteres'            => $row['c_interes'],
                    'numeroContacto'      => $row['c_nmero_de_contacto'],
                    'correo'              => $row['c_correo'],
                    'codigo'              => $row['c_codigo'],
                    'amount'              => $row['amount'],
                    'amountCurrency'      => $row['amount_currency'],
                    'probability'         => $row['probability'],
                    'leadSource'          => $row['lead_source'],
                    'closeDate'           => $row['close_date'],
                    'createdAt'           => $row['created_at'],
                    'assignedUserId'      => $row['assigned_user_id'],
                    'assignedUserName'    => trim($row['assigned_user_name'] ?? ''),
                    'assignedUserAvatar'  => $assignedUserAvatar,
                    'ambassadorId'        => $row['c_ambassador_id'],
                    'ambassadorName'      => trim($row['ambassador_name'] ?? ''),
                    'teamName'            => $teamName,
                    'notas'               => $notas
                ]
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

            $leadId = $body['leadId'] ?? null;
            $campo  = $body['campo'] ?? null;
            $valor  = $body['valor'] ?? null;

            if (!$leadId || !$campo) {
                return ['success' => false, 'error' => 'Datos incompletos'];
            }

            $camposPermitidos = [
                'name', 'description', 'c_interes',
                'c_nmero_de_contacto', 'c_correo'
            ];

            if (!in_array($campo, $camposPermitidos)) {
                return ['success' => false, 'error' => 'Campo no editable'];
            }

            if ($campo === 'c_correo' && $valor) {
                if (!filter_var($valor, FILTER_VALIDATE_EMAIL)) {
                    return ['success' => false, 'error' => 'El formato del correo electrónico no es válido'];
                }
            }

            $entityManager = $this->getContainer()->get('entityManager');
            $pdo = $entityManager->getPDO();

            $sql = "UPDATE opportunity SET `{$campo}` = ?, modified_at = NOW() WHERE id = ? AND deleted = 0";
            $sth = $pdo->prepare($sql);
            $sth->execute([$valor, $leadId]);

            return ['success' => true];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function postActionGuardarStage($params, $data, $request)
    {
        try {
            $body = $request->getParsedBody();
            if (is_object($body)) $body = (array) $body;

            $leadId = $body['leadId'] ?? null;
            $stage  = $body['stage'] ?? null;

            if (!$leadId || !$stage) {
                return ['success' => false, 'error' => 'Datos incompletos'];
            }

            if (!array_key_exists($stage, $this->stageMap)) {
                return ['success' => false, 'error' => 'Estado no válido'];
            }

            $entityManager = $this->getContainer()->get('entityManager');
            $pdo = $entityManager->getPDO();

            $sql = "UPDATE opportunity SET stage = ?, last_stage = stage, modified_at = NOW() WHERE id = ? AND deleted = 0";
            $sth = $pdo->prepare($sql);
            $sth->execute([$stage, $leadId]);

            return [
                'success'    => true,
                'stageLabel' => $this->stageMap[$stage]
            ];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function postActionCrearNota($params, $data, $request)
    {
        try {
            $body = $request->getParsedBody();
            if (is_object($body)) $body = (array) $body;

            $leadId = $body['leadId'] ?? null;
            $post   = trim($body['post'] ?? '');

            if (!$leadId || !$post) {
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
                ->execute([$noteId, $leadId]);

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

    private function generateId()
    {
        return substr(str_replace(['+', '/', '='], '', base64_encode(random_bytes(16))), 0, 17);
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
}