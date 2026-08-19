<!-- client/custom/modules/interfaz/res/templates/lista-guias.tpl -->
<link rel="stylesheet" type="text/css" href="client/custom/modules/interfaz/res/css/interfaz.css">
<link rel="stylesheet" type="text/css" href="client/custom/modules/interfaz/res/css/interfaz-lista.css">
<link rel="stylesheet" type="text/css" href="client/custom/modules/interfaz/res/css/interfaz-guias.css">

<div class="int-list-container">

    <!-- Header -->
    <div class="int-page-header">
        <div class="int-header-left">
            <div class="int-header-icon">
                <i class="fas fa-file-pdf"></i>
            </div>
            <div>
                <h1 class="int-page-title">Guías</h1>
                <p class="int-page-subtitle">Documentos y guías disponibles para descarga</p>
            </div>
        </div>
        <div class="int-header-actions" id="int-guias-header-actions">
            <!-- Botones de Casa Nacional se insertan aquí por JS -->
        </div>
    </div>

    <!-- Contenido dinámico -->
    <div id="lista-container">
        <div class="int-loading">
            <div class="int-spinner"></div>
            <p class="int-loading-title">Cargando guías...</p>
        </div>
    </div>

</div>
