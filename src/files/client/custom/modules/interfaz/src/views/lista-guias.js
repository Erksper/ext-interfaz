define("interfaz:views/lista-guias", ["view"], function (Dep) {
    return Dep.extend({
        template: "interfaz:lista-guias",

        setup: function () {
            this.guias = [];
            this.permisos = {
                esAdmin: false,
                esCasaNacional: false
            };
            this.cargando = false;
        },

        afterRender: function () {
            this.cargarPermisos();
        },

        cargarPermisos: function () {
            const self = this;

            Espo.Ajax.getRequest("Usuarios/action/getUserInfo")
                .then(function (response) {
                    if (response.success && response.data) {
                        self.permisos = {
                            esAdmin: response.data.esAdmin,
                            esCasaNacional: response.data.esCasaNacional
                        };
                    }
                    self.renderAcciones();
                    self.cargarGuias();
                })
                .catch(function () {
                    self.renderAcciones();
                    self.cargarGuias();
                });
        },

        puedeGestionar: function () {
            return !!(this.permisos.esAdmin || this.permisos.esCasaNacional);
        },

        renderAcciones: function () {
            const contenedor = this.$el.find('#int-guias-header-actions');
            contenedor.empty();

            if (!this.puedeGestionar()) {
                return;
            }

            const self = this;

            const btnSubir = $('<button class="int-btn int-btn-primary" data-action="subir-guia">' +
                '<i class="fas fa-upload"></i> Subir archivo</button>');
            const btnOrganizar = $('<button class="int-btn int-btn-secondary" data-action="organizar-guias">' +
                '<i class="fas fa-sort"></i> Organizar / Eliminar</button>');

            btnSubir.on('click', function () {
                self.abrirModalSubir();
            });
            btnOrganizar.on('click', function () {
                self.abrirModalOrganizar();
            });

            contenedor.append(btnSubir).append(btnOrganizar);
        },

        abrirModalSubir: function () {
            const self = this;

            this.createView('modalSubirGuia', 'interfaz:views/modals/subir-guia', {}, function (view) {
                view.render();

                self.listenToOnce(view, 'subida', function () {
                    view.close();
                    Espo.Ui.success('Guía subida correctamente');
                    self.cargarGuias();
                });
            });
        },

        abrirModalOrganizar: function () {
            const self = this;

            this.createView('modalOrganizarGuias', 'interfaz:views/modals/organizar-guias', {
                guias: this.guias
            }, function (view) {
                view.render();

                self.listenToOnce(view, 'actualizado', function () {
                    view.close();
                    self.cargarGuias();
                });
            });
        },

        cargarGuias: function () {
            if (this.cargando) return;

            this.cargando = true;
            this.mostrarLoading();

            const self = this;

            Espo.Ajax.getRequest("Guias/action/getLista")
                .then(function (response) {
                    self.cargando = false;

                    if (response.success) {
                        self.guias = response.data;
                        self.renderizarLista();
                    } else {
                        self.mostrarError(response.error || "Error al cargar las guías");
                    }
                })
                .catch(function () {
                    self.cargando = false;
                    self.mostrarError("Error de conexión al servidor");
                });
        },

        mostrarLoading: function () {
            this.$el.find('#lista-container').html(`
                <div class="int-loading">
                    <div class="int-spinner"></div>
                    <p>Cargando guías...</p>
                </div>
            `);
        },

        mostrarError: function (mensaje) {
            this.$el.find('#lista-container').html(`
                <div class="int-alert int-alert-danger">
                    <i class="fas fa-exclamation-circle"></i> ${mensaje}
                </div>
            `);
        },

        renderizarLista: function () {
            const container = this.$el.find('#lista-container');

            if (this.guias.length === 0) {
                container.html(`
                    <div class="int-no-data">
                        <i class="fas fa-file-pdf"></i>
                        <h3>No hay guías disponibles</h3>
                        <p>Aún no se han subido guías o documentos</p>
                    </div>
                `);
                return;
            }

            let html = '<div class="int-guias-grid">';

            this.guias.forEach(function (guia) {
                html += `
                    <div class="int-guia-card" data-id="${guia.id}">
                        <div class="int-guia-icon">
                            <i class="fas fa-file-pdf"></i>
                        </div>
                        <div class="int-guia-info">
                            <div class="int-guia-nombre">${this.escapeHtml(guia.nombre)}</div>
                            ${guia.descripcion
                                ? `<div class="int-guia-descripcion">${this.escapeHtml(guia.descripcion)}</div>`
                                : ''}
                        </div>
                        <div class="int-guia-actions">
                            ${guia.downloadUrl
                                ? `<a href="${guia.downloadUrl}" class="int-btn int-btn-primary" target="_blank">
                                       <i class="fas fa-download"></i> Descargar
                                   </a>`
                                : `<span class="int-guia-sin-archivo">Sin archivo</span>`}
                        </div>
                    </div>
                `;
            }, this);

            html += '</div>';

            container.html(html);
        },

        escapeHtml: function (text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        onRemove: function () {
            this.$el.find('#int-guias-header-actions').off('click');
        }
    });
});
