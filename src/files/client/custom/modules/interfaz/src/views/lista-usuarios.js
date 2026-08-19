define("interfaz:views/lista-usuarios", ["view"], function (Dep) {
    return Dep.extend({
        template: "interfaz:lista-usuarios",

        setup: function () {
            this.paginaActual = this.options.paginaInicial || 1;
            this.usuarios = [];
            this.filtros = {
                cla: null,
                oficina: null,
                rol: null,
                tipo: null,
                estado: null,
                nombre: null
            };
            this.paginacion = {
                pagina: this.paginaActual,
                porPagina: 25,
                total: 0,
                totalPaginas: 0
            };
            this.cargando = false;
            this.permisos = {
                esAdmin: false,
                esCasaNacional: false,
                claUsuario: null,
                oficinaUsuario: null,
                userId: null
            };
            
            console.log("📋 Setup de lista-usuarios completado");
        },

        afterRender: function () {
            console.log("🎨 afterRender - Inicializando vista");
            this.setupEventListeners();
            this.cargarPermisos();
        },

        setupEventListeners: function () {
            const self = this;
            
            this.$el.find('[data-action="aplicar-filtros"]').on('click', function () {
                self.aplicarFiltros();
            });
            
            this.$el.find('[data-action="limpiar-filtros"]').on('click', function () {
                self.limpiarFiltros();
            });
            
            this.$el.find('#filtro-cla').on('change', function () {
                self.onCLAChange($(this).val());
            });
            
            this.$el.find('#filtro-oficina').on('change', function () {
                self.onOficinaChange($(this).val());
            });

            this.$el.find('#filtro-nombre').on('keydown', function (e) {
                if (e.key === 'Enter' || e.keyCode === 13) {
                    e.preventDefault();
                    self.aplicarFiltros();
                }
            });
        },

        cargarPermisos: function () {
            const self = this;
            
            Espo.Ajax.getRequest("Usuarios/action/getUserInfo")
                .then(function (response) {
                    console.log("🔐 Permisos cargados:", response);
                    if (response.success && response.data) {
                        self.permisos = {
                            esAdmin: response.data.esAdmin,
                            esCasaNacional: response.data.esCasaNacional,
                            claUsuario: response.data.claUsuario,
                            oficinaUsuario: response.data.oficinaUsuario,
                            userId: response.data.userId,
                            roles: response.data.roles || []
                        };
                        
                        self.cargarCLAs();
                    } else {
                        self.cargarCLAs();
                    }
                })
                .catch(function (error) {
                    console.error("Error cargando permisos:", error);
                    self.cargarCLAs();
                });
        },

        cargarCLAs: function () {
            const self = this;
            
            Espo.Ajax.getRequest("Usuarios/action/getCLAs")
                .then(function (response) {
                    console.log("🏢 CLAs cargados:", response);
                    if (response.success && response.data) {
                        const selectCLA = self.$el.find('#filtro-cla');
                        selectCLA.empty().append('<option value="">Todos los CLAs</option>');
                        
                        response.data.forEach(function (cla) {
                            selectCLA.append('<option value="' + cla.id + '">' + cla.name + '</option>');
                        });
                        
                        selectCLA.prop('disabled', false);
                        
                        // Restricciones por permisos
                        if (self.permisos.claUsuario && !self.permisos.esAdmin && !self.permisos.esCasaNacional) {
                            selectCLA.val(self.permisos.claUsuario).trigger('change');
                            selectCLA.prop('disabled', true);
                        } else {
                            self.cargarUsuarios();
                        }
                    } else {
                        self.cargarUsuarios();
                    }
                })
                .catch(function (error) {
                    console.error("Error cargando CLAs:", error);
                    self.cargarUsuarios();
                });
        },

        onCLAChange: function (claId) {
            const self = this;
            const oficinaSelect = this.$el.find('#filtro-oficina');
            
            if (!claId) {
                oficinaSelect.html('<option value="">Seleccione un CLA primero</option>').prop('disabled', true);
                this.filtros.oficina = null;
                this.cargarUsuarios();
                return;
            }
            
            oficinaSelect.html('<option value="">Cargando oficinas...</option>').prop('disabled', true);
            this.filtros.cla = claId;
            this.filtros.oficina = null;
            
            Espo.Ajax.getRequest("Usuarios/action/getOficinasByCLA", { claId: claId })
                .then(function (response) {
                    console.log("🏪 Oficinas cargadas:", response);
                    if (response.success && response.data && response.data.length > 0) {
                        oficinaSelect.empty().append('<option value="">Todas las oficinas</option>');
                        response.data.forEach(function (oficina) {
                            oficinaSelect.append('<option value="' + oficina.id + '">' + oficina.name + '</option>');
                        });
                        oficinaSelect.prop('disabled', false);
                    } else {
                        oficinaSelect.html('<option value="">No hay oficinas disponibles</option>').prop('disabled', false);
                    }
                    self.cargarUsuarios();
                })
                .catch(function (error) {
                    console.error("Error cargando oficinas:", error);
                    oficinaSelect.html('<option value="">Error al cargar oficinas</option>').prop('disabled', false);
                    self.cargarUsuarios();
                });
        },

        onOficinaChange: function (oficinaId) {
            this.filtros.oficina = oficinaId;
            this.cargarUsuarios();
        },

        aplicarFiltros: function () {
            this.filtros = {
                cla: this.$el.find('#filtro-cla').val() || null,
                oficina: this.$el.find('#filtro-oficina').val() || null,
                rol: this.$el.find('#filtro-rol').val() || null,
                tipo: this.$el.find('#filtro-tipo').val() || null,
                estado: this.$el.find('#filtro-estado').val() || null,
                nombre: (this.$el.find('#filtro-nombre').val() || '').trim() || null
            };
            
            console.log("🔍 Filtros aplicados:", this.filtros);
            this.paginacion.pagina = 1;
            this.cargarUsuarios();
        },

        limpiarFiltros: function () {
            this.$el.find('#filtro-cla').val('');
            this.$el.find('#filtro-oficina').html('<option value="">Seleccione un CLA primero</option>').prop('disabled', true);
            this.$el.find('#filtro-rol').val('');
            this.$el.find('#filtro-tipo').val('');
            this.$el.find('#filtro-estado').val('');
            this.$el.find('#filtro-nombre').val('');
            
            this.filtros = { cla: null, oficina: null, rol: null, tipo: null, estado: null, nombre: null };
            this.paginacion.pagina = 1;
            this.cargarUsuarios();
        },

        cargarUsuarios: function () {
            if (this.cargando) return;
            
            this.cargando = true;
            this.mostrarLoading();
            
            const params = {
                pagina: this.paginacion.pagina,
                porPagina: this.paginacion.porPagina
            };
            
            if (this.filtros.cla) params.claId = this.filtros.cla;
            if (this.filtros.oficina) params.oficinaId = this.filtros.oficina;
            if (this.filtros.rol) params.rol = this.filtros.rol;
            if (this.filtros.tipo) params.tipo = this.filtros.tipo;
            if (this.filtros.estado !== null && this.filtros.estado !== '') params.estado = this.filtros.estado;
            if (this.filtros.nombre) params.nombre = this.filtros.nombre;
            
            console.log("📡 Cargando usuarios con params:", params);
            
            const self = this;
            
            Espo.Ajax.getRequest("Usuarios/action/getListaUsuarios", params)
                .then(function (response) {
                    self.cargando = false;
                    
                    if (response.success) {
                        console.log("✅ Usuarios cargados:", response.data.length);
                        self.usuarios = response.data;
                        self.paginacion.total = response.total;
                        self.paginacion.totalPaginas = response.totalPaginas;
                        self.renderizarLista();
                    } else {
                        console.error("❌ Error en respuesta:", response.error);
                        self.mostrarError(response.error || "Error al cargar usuarios");
                    }
                })
                .catch(function (error) {
                    console.error("❌ Error de conexión:", error);
                    self.cargando = false;
                    self.mostrarError("Error de conexión al servidor");
                });
        },

        mostrarLoading: function () {
            const container = this.$el.find('#lista-container');
            container.html(`
                <div class="int-loading">
                    <div class="int-spinner"></div>
                    <p>Cargando usuarios...</p>
                </div>
            `);
        },

        mostrarError: function (mensaje) {
            const container = this.$el.find('#lista-container');
            container.html(`
                <div class="int-alert int-alert-danger">
                    <i class="fas fa-exclamation-circle"></i> ${mensaje}
                </div>
            `);
        },

        renderizarLista: function () {
            const container = this.$el.find('#lista-container');
            
            if (this.usuarios.length === 0) {
                container.html(`
                    <div class="int-no-data">
                        <i class="fas fa-users-slash"></i>
                        <h3>No hay usuarios</h3>
                        <p>No se encontraron usuarios con los filtros seleccionados</p>
                    </div>
                `);
                return;
            }
            
            let html = '<div>';
            
            // Contador
            const inicio = (this.paginacion.pagina - 1) * this.paginacion.porPagina + 1;
            const fin = Math.min(this.paginacion.pagina * this.paginacion.porPagina, this.paginacion.total);
            html += `<div class="int-contador">Mostrando ${inicio}–${fin} de <strong>${this.paginacion.total}</strong> usuarios</div>`;
            
            this.usuarios.forEach(function (usuario) {
                const nombreCompleto = [usuario.firstName, usuario.lastName].filter(Boolean).join(' ') || usuario.userName;
                const iniciales = nombreCompleto.substring(0, 2).toUpperCase();
                const avatarUrl = usuario.avatarUrl;
                const estadoActivo = usuario.isActive === '1' || usuario.isActive === 1 || usuario.isActive === true;
                const rolTexto = usuario.rol || usuario.type || 'Usuario';
                const rolLower = rolTexto.toLowerCase();
                let rolColor = '';
                if (rolLower === 'administrador' || rolLower === 'admin') rolColor = '#3498db';
                else if (rolLower === 'casa nacional') rolColor = '#9b59b6';
                else if (rolLower === 'gerente') rolColor = '#e67e22';
                else if (rolLower === 'asesor') rolColor = '#B8A279';
                else rolColor = '#666666';
                
                html += `
                    <div class="int-usuario-card" data-id="${usuario.id}">
                        <div class="row align-items-center">
                            <div class="col-md-2 col-sm-3 text-center">
                                <div class="int-usuario-avatar">
                                    ${avatarUrl ? 
                                        `<img src="${avatarUrl}" class="int-usuario-avatar-img" alt="${nombreCompleto}">` : 
                                        `<span>${iniciales}</span>`
                                    }
                                </div>
                            </div>
                            <div class="col-md-10 col-sm-9">
                                <div class="int-usuario-nombre">
                                    ${this.escapeHtml(nombreCompleto)}
                                    <span class="int-badge ${estadoActivo ? 'int-badge-activo' : 'int-badge-inactivo'} ms-2">
                                        ${estadoActivo ? 'Activo' : 'Inactivo'}
                                    </span>
                                </div>
                                <div class="int-usuario-detalle">
                                    <div class="int-usuario-detalle-item">
                                        <i class="fas fa-envelope"></i>
                                        <span>${this.escapeHtml(usuario.emailAddress || '-')}</span>
                                    </div>
                                    <div class="int-usuario-detalle-item">
                                        <i class="fas fa-phone"></i>
                                        <span>${this.escapeHtml(usuario.phoneNumber || '-')}</span>
                                    </div>
                                    <div class="int-usuario-detalle-item">
                                        <i class="fas fa-tag"></i>
                                        <span class="int-badge int-badge-rol" style="background: ${rolColor};">${this.escapeHtml(rolTexto)}</span>
                                    </div>
                                </div>
                                <div class="int-usuario-detalle-item" style="margin-top: 8px;">
                                    <i class="fas fa-external-link-alt"></i>
                                    <span style="color: var(--int-primary);">Haz clic para ver perfil completo</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }, this);
            
            html += '</div>';
            html += this.renderPaginacion();
            
            container.html(html);
            
            // Eventos click
            const self = this;
            container.find('.int-usuario-card').on('click', function () {
                const userId = $(this).data('id');
                if (userId) {
                    self.getRouter().navigate('#ListaUsuarios/view/' + userId, { trigger: true });
                }
            });
            
            container.find('.int-pag-btn').on('click', function () {
                const pagina = parseInt($(this).data('pagina'), 10);
                if (!isNaN(pagina)) {
                    self.irAPagina(pagina);
                }
            });
        },

        renderPaginacion: function () {
            const pag = this.paginacion;
            if (pag.totalPaginas <= 1) return '';
            
            const actual = pag.pagina;
            const total = pag.totalPaginas;
            const pages = [];
            const rango = 2;
            let ini = Math.max(2, actual - rango);
            let fin = Math.min(total - 1, actual + rango);
            
            pages.push(1);
            if (ini > 2) pages.push('...');
            for (let i = ini; i <= fin; i++) pages.push(i);
            if (fin < total - 1) pages.push('...');
            if (total > 1) pages.push(total);
            
            let html = '<div class="int-paginacion">';
            html += '<div class="int-pag-info">Página ' + actual + ' de ' + total + '</div>';
            html += '<div class="int-pag-controles">';
            
            html += '<button class="int-pag-btn int-pag-nav' + (actual <= 1 ? ' disabled' : '') + '" data-pagina="' + (actual - 1) + '">'
                  + '<i class="fas fa-chevron-left"></i></button>';
            
            pages.forEach(function (p) {
                if (p === '...') {
                    html += '<span class="int-pag-ellipsis">…</span>';
                } else {
                    html += '<button class="int-pag-btn' + (p === actual ? ' active' : '') + '" data-pagina="' + p + '">' + p + '</button>';
                }
            });
            
            html += '<button class="int-pag-btn int-pag-nav' + (actual >= total ? ' disabled' : '') + '" data-pagina="' + (actual + 1) + '">'
                  + '<i class="fas fa-chevron-right"></i></button>';
            
            html += '</div></div>';
            return html;
        },

        irAPagina: function (pagina) {
            if (pagina < 1 || pagina > this.paginacion.totalPaginas || this.cargando) return;
            this.paginacion.pagina = pagina;
            this.cargarUsuarios();
        },

        escapeHtml: function (text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        onRemove: function () {
            this.$el.off('click', '[data-action]');
            this.$el.off('change', '#filtro-cla');
            this.$el.off('change', '#filtro-oficina');
        }
    });
});