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
        $ambassadorId = $request->getQueryParam('ambassadorId');
        $tipo   = $request->getQueryParam('tipo') ?: 'user';
        $texto  = $request->getQueryParam('texto');

        // Para embajadores, el frontend manda userId (el asesor asignado) Y
        // ambassadorId (el id real del embajador). El id que hay que buscar en
        // c_ambassador es ambassadorId, no userId (userId apunta a la tabla user,
        // por eso siempre daba 404 para embajadores).
        $idBusqueda = ($tipo === 'ambassador') ? $ambassadorId : $userId;

        if ($idBusqueda && !$texto) {
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

            $sth->execute([$idBusqueda]);
            $row = $sth->fetch(\PDO::FETCH_ASSOC);
            $texto = $row['qr'] ?? null;
        }

        if (!$texto) {
            $response->setStatus(404);
            return;
        }

        // IMPORTANTE: chillerlan/php-qrcode cambio su API entre versiones mayores,
        // y detectamos DOS versiones distintas instaladas entre el ambiente local
        // y el desplegado (probablemente porque composer.json no fija la version):
        //
        //   - Versiones viejas (v3/v4): QROptions::outputType con la constante
        //     QROutputInterface::GDIMAGE_PNG, QROptions::imageBase64,
        //     eccLevel como entero (QRCode::ECC_M).
        //   - Versiones nuevas (v5/v6-dev): QROptions::outputInterface con el
        //     FQCN de la clase de salida (QRGdImagePNG::class),
        //     QROptions::outputBase64, eccLevel via la clase EccLevel::M.
        //
        // En vez de asumir una sola, se arma el array de opciones detectando en
        // tiempo de ejecucion que existe. Las claves que no aplican a la version
        // instalada simplemente se ignoran (QROptions no truena por claves
        // desconocidas), asi que es seguro mandar ambas.
        $opciones = [
            'version'      => 5,
            'scale'        => 6,
            // Claves de salida en base64: mandamos ambos nombres posibles.
            // Si queda en true (default de la libreria) el render() devuelve
            // un data-URI de texto en vez de bytes PNG, y el navegador muestra
            // "la imagen contiene errores" porque no es un PNG valido.
            'imageBase64'  => false,
            'outputBase64' => false,
        ];

        if (class_exists('chillerlan\QRCode\Common\EccLevel')) {
            // v5+
            $opciones['eccLevel'] = \chillerlan\QRCode\Common\EccLevel::M;
        } else {
            // v3/v4
            $opciones['eccLevel'] = QRCodeGenerator::ECC_M;
        }

        if (class_exists('chillerlan\QRCode\Output\QRGdImagePNG')) {
            // v5+: FQCN de la clase de salida
            $opciones['outputInterface'] = 'chillerlan\QRCode\Output\QRGdImagePNG';
        } elseif (
            class_exists('chillerlan\QRCode\Output\QROutputInterface') &&
            defined('chillerlan\QRCode\Output\QROutputInterface::GDIMAGE_PNG')
        ) {
            // v3/v4: constante clasica
            $opciones['outputType'] = \chillerlan\QRCode\Output\QROutputInterface::GDIMAGE_PNG;
        }

        $options = new QROptions($opciones);

        $qr = new QRCodeGenerator($options);
        $imageData = $qr->render($texto);

        $response->setHeader('Content-Type', 'image/png');
        $response->setHeader('Cache-Control', 'max-age=3600');
        $response->writeBody($imageData);
    }
}
