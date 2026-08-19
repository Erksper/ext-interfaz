<link rel="stylesheet" type="text/css" href="client/custom/modules/interfaz/res/css/interfaz.css">
<link rel="stylesheet" type="text/css" href="client/custom/modules/interfaz/res/css/interfaz-lista.css">

<div class="int-list-container">

    <div class="int-page-header">
        <div class="int-header-left">
            <div class="int-header-icon">
                <i class="fas fa-address-card"></i>
            </div>
            <div>
                <h1 class="int-page-title">Lista de Embajadores</h1>
                <p class="int-page-subtitle">Gestión y visualización de embajadores</p>
            </div>
        </div>
        <div class="int-header-right">
            <button class="int-btn int-btn-primary" id="btn-crear-embajador">
                <i class="fas fa-plus"></i> Nuevo Embajador
            </button>
        </div>
    </div>

    <!-- Filtros -->
    <div class="int-filtro-card">
        <div class="int-filtro-busqueda">
            <i class="fas fa-search"></i>
            <input type="text" id="filtro-nombre" class="int-form-control"
                   placeholder="Buscar por nombre...">
        </div>
        <div class="int-filtros-grid">
            <div class="int-filtro-group" id="fila-cla-oficina">
                <label>CLA</label>
                <select id="filtro-cla" class="int-form-control" disabled>
                    <option value="">Todos los CLAs</option>
                </select>
            </div>
            <div class="int-filtro-group" id="fila-cla-oficina">
                <label>Oficina</label>
                <select id="filtro-oficina" class="int-form-control" disabled>
                    <option value="">Seleccione un CLA primero</option>
                </select>
            </div>
            <div class="int-filtro-group" id="fila-asesor">
                <label>Asesor</label>
                <select id="filtro-asesor" class="int-form-control" disabled>
                    <option value="">Todos los asesores</option>
                </select>
            </div>
            <div class="int-filtro-group">
                <label>Estatus</label>
                <select id="filtro-status" class="int-form-control">
                    <option value="">Todos</option>
                    <option value="0">Pendiente</option>
                    <option value="1">En proceso</option>
                    <option value="2">Activo</option>
                    <option value="3">Inactivo</option>
                </select>
            </div>
        </div>
        <div class="int-filtro-actions">
            <button class="int-btn int-btn-primary" data-action="aplicar-filtros">
                <i class="fas fa-search"></i> Buscar
            </button>
            <button class="int-btn int-btn-secondary" data-action="limpiar-filtros">
                <i class="fas fa-times"></i> Limpiar
            </button>
        </div>
    </div>

    <div id="lista-container">
        <div class="int-loading">
            <div class="int-spinner"></div>
            <p>Cargando embajadores...</p>
        </div>
    </div>

</div>