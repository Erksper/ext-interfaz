<!-- client/custom/modules/interfaz/res/templates/modals/editar-copy.tpl -->
<link rel="stylesheet" type="text/css" href="client/custom/modules/interfaz/res/css/interfaz.css">
<link rel="stylesheet" type="text/css" href="client/custom/modules/interfaz/res/css/interfaz-copys.css">

<div class="int-modal-form">
    <div class="form-group">
        <label for="int-copy-nombre">Nombre <span class="text-danger">*</span></label>
        <input type="text" class="form-control" id="int-copy-nombre" maxlength="255">
    </div>

    <div class="form-group">
        <label for="int-copy-descripcion">Descripción</label>
        <textarea class="form-control" id="int-copy-descripcion" rows="3"></textarea>
    </div>

    <div class="form-group">
        <label for="int-copy-file">Reemplazar archivo (opcional)</label>
        <div id="int-copy-archivo-actual" class="int-file-name"></div>
        <input type="file" id="int-copy-file" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx" class="form-control">
        <div id="int-copy-file-name" class="int-file-name"></div>
    </div>

    <div class="form-group">
        <label>Roles con acceso <span class="text-danger">*</span></label>
        <div class="int-roles-selector-header">
            <span></span>
            <button type="button" class="int-btn-link" id="int-copy-roles-toggle-todos">Seleccionar / deseleccionar todos</button>
        </div>
        <div id="int-copy-roles-lista" class="int-roles-selector-lista">
            <div class="int-loading">
                <div class="int-spinner"></div>
                <p>Cargando roles...</p>
            </div>
        </div>
    </div>
</div>
