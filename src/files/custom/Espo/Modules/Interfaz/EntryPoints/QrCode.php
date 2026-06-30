<?php
namespace Espo\Modules\Interfaz\EntryPoints;

use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\EntryPoint\EntryPoint;
use Espo\Core\EntryPoint\Traits\NoAuth;
use Espo\Core\ORM\EntityManager;

use chillerlan\QRCode\QRCode as QRCodeGenerator;
use chillerlan\QRCode\QROptions;

class QrCode implements EntryPoint
{
    use NoAuth;

    public function __construct(
        private EntityManager $entityManager
    ) {}

    public function run(Request $request, Response $response): void
    {
        $userId = $request->getQueryParam('userId');
        $tipo   = $request->getQueryParam('tipo') ?: 'user';
        $texto  = $request->getQueryParam('texto');

        if ($userId && !$texto) {
            $pdo = $this->entityManager->getPDO();

            if ($tipo === 'ambassador') {
                $sth = $pdo->prepare(
                    "SELECT qr FROM c_ambassador WHERE id = ? AND deleted = 0 LIMIT 1"
                );
            } else {
                $sth = $pdo->prepare(
                    "SELECT c_qr as qr FROM user WHERE id = ? AND deleted = 0 LIMIT 1"
                );
            }

            $sth->execute([$userId]);
            $row = $sth->fetch(\PDO::FETCH_ASSOC);
            $texto = $row['qr'] ?? null;
        }

        if (!$texto) {
            $response->setStatus(404);
            return;
        }

        $options = new QROptions([
            'version'     => 5,
            'outputType'  => \chillerlan\QRCode\Output\QROutputInterface::GDIMAGE_PNG,
            'eccLevel'    => QRCodeGenerator::ECC_M,
            'scale'       => 6,
            'imageBase64' => false,
        ]);

        $qr = new QRCodeGenerator($options);
        $imageData = $qr->render($texto);

        $response->setHeader('Content-Type', 'image/png');
        $response->setHeader('Cache-Control', 'max-age=3600');
        $response->writeBody($imageData);
    }
}