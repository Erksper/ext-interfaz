<!-- client/custom/modules/interfaz/res/templates/modals/subir-guia.tpl -->
<link rel="stylesheet" type="text/css" href="client/custom/modules/interfaz/res/css/interfaz.css">
<link rel="stylesheet" type="text/css" href="client/custom/modules/interfaz/res/css/interfaz-guias.css">

<div class="int-modal-form">
    <div class="form-group">
        <label for="int-guia-nombre">Nombre <span class="text-danger">*</span></label>
        <input type="text" class="form-control" id="int-guia-nombre" maxlength="255" placeholder="Ej: Manual del Asesor 2026">
    </div>

    <div class="form-group">
        <label for="int-guia-descripcion">Descripción</label>
        <textarea class="form-control" id="int-guia-descripcion" rows="3" placeholder="Breve descripción del contenido (opcional)"></textarea>
    </div>

    <div class="form-group">
        <label for="int-guia-file">Archivo PDF <span class="text-danger">*</span></label>
        <input type="file" id="int-guia-file" accept="application/pdf,.pdf" class="form-control">
        <div id="int-guia-file-name" class="int-file-name"></div>
    </div>
</div>
