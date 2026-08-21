<!-- client/custom/modules/interfaz/res/templates/lista-copys.tpl -->
<link rel="stylesheet" type="text/css" href="client/custom/modules/interfaz/res/css/interfaz.css">
<link rel="stylesheet" type="text/css" href="client/custom/modules/interfaz/res/css/interfaz-lista.css">
<link rel="stylesheet" type="text/css" href="client/custom/modules/interfaz/res/css/interfaz-copys.css">

<div class="int-list-container">

    <!-- Header -->
    <div class="int-page-header">
        <div class="int-header-left">
            <div class="int-header-icon">
                <i class="fas fa-copy"></i>
            </div>
            <div>
                <h1 class="int-page-title">Copys</h1>
                <p class="int-page-subtitle">Documentos y materiales disponibles según tu rol</p>
            </div>
        </div>
        <div class="int-header-actions" id="int-copys-header-actions">
            <!-- Botones de Casa Nacional se insertan aquí por JS -->
        </div>
    </div>

    <!-- Contenido dinámico -->
    <div id="lista-container">
        <div class="int-loading">
            <div class="int-spinner"></div>
            <p class="int-loading-title">Cargando copys...</p>
        </div>
    </div>

</div>
