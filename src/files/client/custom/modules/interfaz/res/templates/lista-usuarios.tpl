<!-- client/custom/modules/interfaz/res/templates/lista-usuarios.tpl -->
<link rel="stylesheet" type="text/css" href="client/custom/modules/interfaz/res/css/interfaz.css">
<link rel="stylesheet" type="text/css" href="client/custom/modules/interfaz/res/css/interfaz-lista.css">

<div class="int-list-container">

    <!-- Header -->
    <div class="int-page-header">
        <div class="int-header-left">
            <div class="int-header-icon">
                <i class="fas fa-users"></i>
            </div>
            <div>
                <h1 class="int-page-title">Lista de Usuarios</h1>
                <p class="int-page-subtitle">Gestión y visualización de usuarios del sistema</p>
            </div>
        </div>
    </div>

    <!-- Filtros -->
    <div class="int-filtro-card">
        <div class="int-filtros-grid">
            <div class="int-filtro-group">
                <label>CLA</label>
                <select id="filtro-cla" class="int-form-control">
                    <option value="">Todos los CLAs</option>
                </select>
            </div>
            <div class="int-filtro-group">
                <label>Oficina</label>
                <select id="filtro-oficina" class="int-form-control" disabled>
                    <option value="">Seleccione un CLA primero</option>
                </select>
            </div>
            <div class="int-filtro-group">
                <label>Rol</label>
                <select id="filtro-rol" class="int-form-control">
                    <option value="">Todos los roles</option>
                    <option value="casa nacional">Casa Nacional</option>
                    <option value="gerente">Gerente</option>
                    <option value="director">Director</option>
                    <option value="coordinador">Coordinador</option>
                    <option value="afiliado">Afiliado</option>
                    <option value="asesor">Asesor</option>
                </select>
            </div>
            <div class="int-filtro-group">
                <label>Tipo de Usuario</label>
                <select id="filtro-tipo" class="int-form-control">
                    <option value="">Todos</option>
                    <option value="admin">Administrador</option>
                    <option value="regular">Regular</option>
                    <option value="portal">Portal</option>
                </select>
            </div>
            <div class="int-filtro-group">
                <label>Estado</label>
                <select id="filtro-estado" class="int-form-control">
                    <option value="">Todos</option>
                    <option value="1">Activo</option>
                    <option value="0">Inactivo</option>
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

    <!-- Contenido dinámico -->
    <div id="lista-container">
        <div class="int-loading">
            <div class="int-spinner"></div>
            <p class="int-loading-title">Cargando usuarios...</p>
        </div>
    </div>

</div>