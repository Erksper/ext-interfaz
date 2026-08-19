<link rel="stylesheet" type="text/css" href="client/custom/modules/interfaz/res/css/interfaz.css">
<link rel="stylesheet" type="text/css" href="client/custom/modules/interfaz/res/css/interfaz-lista.css">
<link rel="stylesheet" type="text/css" href="client/custom/modules/interfaz/res/css/interfaz-kanban.css">

<div class="int-list-container">

    <div class="int-page-header">
        <div class="int-header-left">
            <div class="int-header-icon">
                <i class="fas fa-bullseye"></i>
            </div>
            <div>
                <h1 class="int-page-title">Lista de Leads</h1>
                <p class="int-page-subtitle">Gestión y visualización de leads del sistema</p>
            </div>
        </div>
        <div class="int-header-right">
            <button class="int-btn int-btn-secondary" id="btn-toggle-vista">
                <i class="fas fa-columns"></i> Ver por Estados
            </button>
        </div>
    </div>

    <!-- Filtros -->
    <div class="int-filtro-card">
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
                <label>Interés</label>
                <select id="filtro-interes" class="int-form-control">
                    <option value="">Todos</option>
                    <option value="compra">Compra</option>
                    <option value="venta">Venta</option>
                    <option value="arrendador">Arrendador</option>
                    <option value="Desea Alquilar Apartamento">Desea Alquilar Apartamento</option>
                </select>
            </div>
            <div class="int-filtro-group" id="filtro-stage-wrap">
                <label>Estado</label>
                <select id="filtro-stage" class="int-form-control">
                    <option value="">Todos</option>
                </select>
            </div>
            <div class="int-filtro-group">
                <label>Fecha desde</label>
                <input type="date" id="filtro-fecha-desde" class="int-form-control">
            </div>
            <div class="int-filtro-group">
                <label>Fecha hasta</label>
                <input type="date" id="filtro-fecha-hasta" class="int-form-control">
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

    <!-- Vista lista -->
    <div id="vista-lista-container">
        <div class="int-loading">
            <div class="int-spinner"></div>
            <p>Cargando leads...</p>
        </div>
    </div>

    <!-- Vista kanban -->
    <div id="vista-kanban-container" style="display:none;"></div>

</div>
