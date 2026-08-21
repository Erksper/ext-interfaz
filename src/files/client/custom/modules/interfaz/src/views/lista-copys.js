define("interfaz:views/lista-copys", ["view"], function (Dep) {
    return Dep.extend({
        template: "interfaz:lista-copys",

        setup: function () {
            this.copys = [];
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
                    self.cargarCopys();
                })
                .catch(function () {
                    self.renderAcciones();
                    self.cargarCopys();
                });
        },

        puedeGestionar: function () {
            return !!(this.permisos.esAdmin || this.permisos.esCasaNacional);
        },

        renderAcciones: function () {
            const contenedor = this.$el.find('#int-copys-header-actions');
            contenedor.empty();

            if (!this.puedeGestionar()) {
                return;
            }

            const self = this;

            const btnSubir = $('<button class="int-btn int-btn-primary" data-action="subir-copy">' +
                '<i class="fas fa-upload"></i> Subir archivo</button>');
            const btnOrganizar = $('<button class="int-btn int-btn-secondary" data-action="organizar-copys">' +
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

            this.createView('modalSubirCopy', 'interfaz:views/modals/subir-copy', {}, function (view) {
                view.render();

                self.listenToOnce(view, 'subida', function () {
                    view.close();
                    Espo.Ui.success('Copy subido correctamente');
                    self.cargarCopys();
                });
            });
        },

        abrirModalEditar: function (copy) {
            const self = this;

            this.createView('modalEditarCopy', 'interfaz:views/modals/editar-copy', {
                copy: copy
            }, function (view) {
                view.render();

                self.listenToOnce(view, 'actualizado', function () {
                    view.close();
                    Espo.Ui.success('Copy actualizado correctamente');
                    self.cargarCopys();
                });
            });
        },

        abrirModalOrganizar: function () {
            const self = this;

            this.createView('modalOrganizarCopys', 'interfaz:views/modals/organizar-copys', {
                copys: this.copys
            }, function (view) {
                view.render();

                self.listenToOnce(view, 'actualizado', function () {
                    view.close();
                    self.cargarCopys();
                });
            });
        },

        cargarCopys: function () {
            if (this.cargando) return;

            this.cargando = true;
            this.mostrarLoading();

            const self = this;

            Espo.Ajax.getRequest("Copys/action/getLista")
                .then(function (response) {
                    self.cargando = false;

                    if (response.success) {
                        self.copys = response.data;
                        self.renderizarLista();
                    } else {
                        self.mostrarError(response.error || "Error al cargar los copys");
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
                    <p>Cargando copys...</p>
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
            const self = this;

            if (this.copys.length === 0) {
                container.html(`
                    <div class="int-no-data">
                        <i class="fas fa-copy"></i>
                        <h3>No hay copys disponibles</h3>
                        <p>Aún no hay documentos visibles para tu rol</p>
                    </div>
                `);
                return;
            }

            let html = '<div class="int-copys-grid">';

            this.copys.forEach(function (copy) {
                const icono = self.iconoParaTipo(copy.archivoTipo, copy.archivoNombre);
                const editBtn = self.puedeGestionar()
                    ? `<button class="int-btn int-btn-secondary int-copy-edit-btn" data-id="${copy.id}" title="Editar">
                           <i class="fas fa-pencil-alt"></i>
                       </button>`
                    : '';

                html += `
                    <div class="int-copy-card" data-id="${copy.id}">
                        <div class="int-copy-icon" style="background:${icono.bg};color:${icono.color};">
                            <i class="${icono.clase}"></i>
                        </div>
                        <div class="int-copy-info">
                            <div class="int-copy-nombre">${self.escapeHtml(copy.nombre)}</div>
                            ${copy.descripcion
                                ? `<div class="int-copy-descripcion">${self.escapeHtml(copy.descripcion)}</div>`
                                : ''}
                            ${self.puedeGestionar() && copy.roles && copy.roles.length
                                ? `<div class="int-copy-roles">${copy.roles.map(r =>
                                    `<span class="int-copy-role-tag">${self.escapeHtml(r)}</span>`).join('')}</div>`
                                : ''}
                        </div>
                        <div class="int-copy-actions">
                            ${copy.downloadUrl
                                ? `<a href="${copy.downloadUrl}" class="int-btn int-btn-primary" target="_blank">
                                       <i class="fas fa-download"></i> Descargar
                                   </a>`
                                : `<span class="int-copy-sin-archivo">Sin archivo</span>`}
                            ${editBtn}
                        </div>
                    </div>
                `;
            });

            html += '</div>';

            container.html(html);

            container.find('.int-copy-edit-btn').on('click', function (e) {
                e.preventDefault();
                const id = $(this).data('id');
                const copy = self.copys.find(function (c) { return c.id === id; });
                if (copy) self.abrirModalEditar(copy);
            });
        },

        iconoParaTipo: function (mime, nombre) {
            const ext = (nombre || '').split('.').pop().toLowerCase();

            if (mime === 'application/pdf' || ext === 'pdf') {
                return { clase: 'fas fa-file-pdf', bg: '#FDECEA', color: '#E74C3C' };
            }
            if ((mime && mime.indexOf('image/') === 0) || ['jpg','jpeg','png','gif','webp'].indexOf(ext) !== -1) {
                return { clase: 'fas fa-file-image', bg: '#EAF4FD', color: '#3498DB' };
            }
            if (ext === 'doc' || ext === 'docx' || (mime && mime.indexOf('word') !== -1)) {
                return { clase: 'fas fa-file-word', bg: '#EAF1FB', color: '#2E5FA3' };
            }
            if (ext === 'xls' || ext === 'xlsx' || (mime && mime.indexOf('sheet') !== -1) || (mime && mime.indexOf('excel') !== -1)) {
                return { clase: 'fas fa-file-excel', bg: '#EAFBF0', color: '#27AE60' };
            }
            if (ext === 'ppt' || ext === 'pptx' || (mime && mime.indexOf('presentation') !== -1) || (mime && mime.indexOf('powerpoint') !== -1)) {
                return { clase: 'fas fa-file-powerpoint', bg: '#FDF2EA', color: '#D35400' };
            }

            return { clase: 'fas fa-file', bg: '#F0F0F0', color: '#666' };
        },

        escapeHtml: function (text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        onRemove: function () {
            this.$el.find('#int-copys-header-actions').off('click');
        }
    });
});
