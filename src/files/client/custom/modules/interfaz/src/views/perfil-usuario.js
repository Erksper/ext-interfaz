define("interfaz:views/perfil-usuario", ["view"], function (Dep) {
    return Dep.extend({
        template: "interfaz:perfil-usuario",

        setup: function () {
            this.userId = this.options.userId;
            this.userData = null;
        },

        afterRender: function () {
            this.cargarPerfil();
        },

        cargarPerfil: function () {
            const self = this;
            Espo.Ajax.getRequest("Usuarios/action/getPerfilUsuario", { userId: this.userId })
                .then(function (response) {
                    if (response.success) {
                        self.userData = response.data;
                        self.renderPerfil(response.data);
                    } else {
                        self.mostrarError(response.error);
                    }
                })
                .catch(function () {
                    self.mostrarError('Error de conexión');
                });
        },

        renderPerfil: function (d) {
            const self = this;
            const container = this.$el.find('#perfil-container');

            // Avatar
            let avatarHtml = '';
            let fotoSrc = null;

            if (d.fotoExterna) {
                fotoSrc = d.fotoExterna;
            } else if (d.avatarUrl) {
                fotoSrc = d.avatarUrl;
            }

            if (fotoSrc) {
                const iniciales = ((d.firstName || '')[0] || '') + ((d.lastName || '')[0] || '');
                avatarHtml = `<img src="${fotoSrc}" class="int-avatar-img" alt="Foto"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                    <div class="int-avatar-placeholder" style="display:none;">
                        ${iniciales.toUpperCase() || '?'}
                    </div>`;
            } else {
                const iniciales = ((d.firstName || '')[0] || '') + ((d.lastName || '')[0] || '');
                avatarHtml = `<div class="int-avatar-placeholder">${iniciales.toUpperCase() || '?'}</div>`;
            }

            const editAvatarBtn = d.fotoEditable
                ? `<label class="int-avatar-edit-btn" title="Cambiar foto" for="int-avatar-file-input">
                       <i class="fas fa-camera"></i>
                   </label>
                   <input type="file" id="int-avatar-file-input" accept="image/*">`
                : '';

            const estadoBadge = d.isActive == 1
                ? '<span class="int-badge int-badge-activo">Activo</span>'
                : '<span class="int-badge int-badge-inactivo">Inactivo</span>';

            const tipoBadge = `<span class="int-badge int-badge-rol">${this.escapeHtml(d.type || '')}</span>`;

            const teamsHtml = d.teams && d.teams.length
                ? d.teams.map(t => `<span class="int-tag">${this.escapeHtml(t.name)}</span>`).join('')
                : '<span class="int-field-value empty">Sin equipos</span>';

            const defaultTeamHtml = d.defaultTeamName
                ? `<span class="int-tag">${this.escapeHtml(d.defaultTeamName)}</span>`
                : '<span class="int-field-value empty">Sin equipo por defecto</span>';

            const rolesHtml = d.roles && d.roles.length
                ? d.roles.map(r => `<span class="int-tag">${this.escapeHtml(r.name)}</span>`).join('')
                : '<span class="int-field-value empty">Sin roles</span>';

            const notasHtml = this.renderNotas(d.notas || []);

            // QR
            const qrHtml = d.qrImageUrl
                ? `<a href="${this.escapeHtml(d.qr || '#')}" target="_blank" title="Abrir URL del QR">
                       <img src="${this.escapeHtml(d.qrImageUrl)}" class="int-qr-img" alt="Código QR">
                   </a>`
                : '<span class="int-field-value empty">No disponible</span>';

            const html = `
            <div class="int-page-header">
                <div class="int-header-left">
                    <div class="int-header-icon">
                        <i class="fas fa-user"></i>
                    </div>
                    <div>
                        <h1 class="int-page-title">Perfil de Usuario</h1>
                        <p class="int-page-subtitle">
                            ${this.escapeHtml((d.firstName || '') + ' ' + (d.lastName || ''))}
                        </p>
                    </div>
                </div>
                <div class="int-header-right">
                    <button class="int-btn int-btn-secondary" id="btn-volver">
                        <i class="fas fa-arrow-left"></i> Volver a la lista
                    </button>
                </div>
            </div>

            <div class="int-perfil-top">

                <!-- Columna avatar -->
                <div class="int-avatar-card">
                    <div class="int-avatar-wrap">
                        ${avatarHtml}
                        ${editAvatarBtn}
                    </div>
                    <div class="int-avatar-username">@${this.escapeHtml(d.userName)}</div>
                    <div class="int-avatar-badges">
                        ${estadoBadge}
                        ${tipoBadge}
                    </div>
                </div>

                <!-- Grupo 1: Datos personales -->
                <div class="int-info-card">
                    <h3 class="int-info-card-title">
                        <i class="fas fa-id-card"></i> Datos Personales
                    </h3>
                    <div class="int-fields-grid">
                        ${this.renderField('Nombre', 'first_name', d.firstName, true)}
                        ${this.renderField('Apellido', 'last_name', d.lastName, true)}
                        ${this.renderField('Título', 'title', d.title, true)}
                        ${this.renderField('Género', 'gender',
                            d.gender === 'Male' ? 'Masculino' : d.gender === 'Female' ? 'Femenino' : d.gender,
                            true, 'select',
                            [{val:'Male',label:'Masculino'},{val:'Female',label:'Femenino'}],
                            d.gender)}
                        ${this.renderField('Correo electrónico', 'email', d.emailAddress, true, 'email')}
                        ${this.renderField('Teléfono', 'phone', d.phoneNumber, true)}
                        ${this.renderField('Tipo de carnet', 'c_tipode_carnet', d.tipoCarnet, true, 'select',
                            [{val:'1',label:'Asesor'},{val:'2',label:'Asesor Certificado'}],
                            d.tipoCarnetVal)}
                        ${this.renderFieldReadonly('URL de perfil', d.urlPerfil, 'link')}
                        ${this.renderFieldReadonly('Carnet', d.carnet, 'link')}
                    </div>
                    ${this.renderFieldText('Descripción de perfil', 'c_descripcionperfil', d.descripcionPerfil, true)}
                    <div class="int-field" style="margin-top:16px;">
                        <span class="int-field-label">Código QR</span>
                        <div class="int-qr-container">
                            ${qrHtml}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Grupo 2: Datos de la oficina -->
            <div class="int-info-card">
                <h3 class="int-info-card-title">
                    <i class="fas fa-building"></i> Datos de la Oficina
                </h3>
                <div class="int-fields-grid">
                    <div class="int-field">
                        <span class="int-field-label">Equipos</span>
                        <div class="int-tags-wrap">${teamsHtml}</div>
                    </div>
                    <div class="int-field">
                        <span class="int-field-label">Equipo por defecto</span>
                        <div class="int-tags-wrap">${defaultTeamHtml}</div>
                    </div>
                    <div class="int-field">
                        <span class="int-field-label">Roles</span>
                        <div class="int-tags-wrap">${rolesHtml}</div>
                    </div>
                </div>
            </div>

            <!-- Grupo 3: Observaciones -->
            <div class="int-info-card">
                <h3 class="int-info-card-title">
                    <i class="fas fa-comments"></i> Observaciones
                </h3>
                <div class="int-nueva-nota">
                    <textarea id="int-nueva-nota-input" class="int-field-input"
                        rows="3" placeholder="Escribe una observación..."></textarea>
                    <div style="display:flex;justify-content:flex-end;margin-top:8px;">
                        <button class="int-field-save-btn" id="int-btn-crear-nota">
                            <i class="fas fa-paper-plane"></i> Publicar
                        </button>
                    </div>
                </div>
                <div id="int-notas-lista">
                    ${notasHtml}
                </div>
            </div>`;

            container.html(html);
            this.setupEvents();

            if (d.fotoEditable) {
                container.find('#int-avatar-file-input').on('change', function (e) {
                    const file = e.target.files[0];
                    if (file) self.subirAvatar(file);
                });
            }
        },

        renderNotas: function (notas) {
            if (!notas.length) {
                return '<p class="int-notas-empty">Sin observaciones aún</p>';
            }
            return notas.map(n => this.renderNotaItem(n)).join('');
        },

        renderNotaItem: function (n) {
            const inicial = (n.autorNombre || '?')[0].toUpperCase();
            const avatarHtml = n.autorAvatar
                ? `<img src="${n.autorAvatar}" alt="" style="width:100%;height:100%;object-fit:cover;">`
                : inicial;

            const fecha = new Date(n.createdAt).toLocaleDateString('es-ES', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            return `
            <div class="int-nota-item">
                <div class="int-nota-header">
                    <div class="int-nota-avatar">${avatarHtml}</div>
                    <span class="int-nota-autor">${this.escapeHtml(n.autorNombre)}</span>
                    <span class="int-nota-fecha">${fecha}</span>
                </div>
                <div class="int-nota-texto">${this.escapeHtml(n.post)}</div>
            </div>`;
        },

        renderField: function (label, campo, valor, editable, tipo, opciones, rawVal) {
            const displayVal = valor
                ? `<span class="int-field-value">${this.escapeHtml(String(valor))}</span>`
                : `<span class="int-field-value empty">No especificado</span>`;

            const editBtn = editable
                ? `<button class="int-field-edit-btn" data-campo="${campo}" title="Editar">
                       <i class="fas fa-pencil-alt"></i>
                   </button>`
                : '';

            let inputHtml = '';
            if (tipo === 'select' && opciones) {
                const currentVal = rawVal || '';
                inputHtml = `<select class="int-field-input" data-campo="${campo}">
                    ${opciones.map(o =>
                        `<option value="${o.val}" ${String(o.val) === String(currentVal) ? 'selected' : ''}>
                            ${o.label}
                        </option>`
                    ).join('')}
                </select>`;
            } else if (tipo === 'email') {
                inputHtml = `<input type="email" class="int-field-input" data-campo="${campo}"
                    value="${this.escapeHtml(valor || '')}">`;
            } else {
                inputHtml = `<input type="text" class="int-field-input" data-campo="${campo}"
                    value="${this.escapeHtml(String(valor || ''))}">`;
            }

            return `
            <div class="int-field" data-campo="${campo}">
                <span class="int-field-label">${label}</span>
                <div class="int-field-view-mode">
                    <div class="int-field-value-wrap">
                        ${displayVal}
                        ${editBtn}
                    </div>
                </div>
                ${editable ? `
                <div class="int-field-edit-mode">
                    ${inputHtml}
                    <div class="int-field-actions">
                        <button class="int-field-save-btn" data-campo="${campo}">Guardar</button>
                        <button class="int-field-cancel-btn" data-campo="${campo}">Cancelar</button>
                    </div>
                </div>` : ''}
            </div>`;
        },

        renderFieldText: function (label, campo, valor, editable) {
            const displayVal = valor
                ? `<span class="int-field-value">${this.escapeHtml(String(valor))}</span>`
                : `<span class="int-field-value empty">No especificado</span>`;

            return `
            <div class="int-field" data-campo="${campo}" style="margin-top:16px;">
                <span class="int-field-label">${label}</span>
                <div class="int-field-view-mode">
                    <div class="int-field-value-wrap">
                        ${displayVal}
                        ${editable ? `<button class="int-field-edit-btn" data-campo="${campo}" title="Editar">
                            <i class="fas fa-pencil-alt"></i></button>` : ''}
                    </div>
                </div>
                ${editable ? `
                <div class="int-field-edit-mode">
                    <textarea class="int-field-input" data-campo="${campo}" rows="3">${this.escapeHtml(valor || '')}</textarea>
                    <div class="int-field-actions">
                        <button class="int-field-save-btn" data-campo="${campo}">Guardar</button>
                        <button class="int-field-cancel-btn" data-campo="${campo}">Cancelar</button>
                    </div>
                </div>` : ''}
            </div>`;
        },

        renderFieldReadonly: function (label, valor, tipo) {
            let valueHtml = '';
            if (tipo === 'link' && valor) {
                valueHtml = `<a href="${this.escapeHtml(valor)}" target="_blank" class="int-field-link">
                    <i class="fas fa-external-link-alt" style="margin-right:4px;font-size:11px;"></i>
                    ${this.escapeHtml(valor)}
                </a>`;
            } else {
                valueHtml = valor
                    ? `<span class="int-field-value">${this.escapeHtml(valor)}</span>`
                    : `<span class="int-field-value empty">No especificado</span>`;
            }

            return `
            <div class="int-field">
                <span class="int-field-label">${label}</span>
                <div class="int-field-value-wrap">${valueHtml}</div>
            </div>`;
        },

        setupEvents: function () {
            const self = this;
            const container = this.$el.find('#perfil-container');

            // Volver
            container.find('#btn-volver').on('click', function () {
                self.getRouter().navigate('#ListaUsuarios', { trigger: true });
            });

            // Lápiz — activar edición
            container.on('click', '.int-field-edit-btn', function () {
                const campo = $(this).data('campo');
                const fieldEl = container.find(`.int-field[data-campo="${campo}"]`);
                fieldEl.find('.int-field-view-mode').addClass('hidden');
                fieldEl.find('.int-field-edit-mode').addClass('active');
                fieldEl.find('.int-field-input').first().focus();
            });

            // Cancelar edición
            container.on('click', '.int-field-cancel-btn', function () {
                const campo = $(this).data('campo');
                const fieldEl = container.find(`.int-field[data-campo="${campo}"]`);
                fieldEl.find('.int-field-view-mode').removeClass('hidden');
                fieldEl.find('.int-field-edit-mode').removeClass('active');
            });

            // Guardar campo
            container.on('click', '.int-field-save-btn[data-campo]', function () {
                const campo = $(this).data('campo');
                const fieldEl = container.find(`.int-field[data-campo="${campo}"]`);
                const valor = fieldEl.find('.int-field-input').val();
                self.guardarCampo(campo, valor, fieldEl);
            });

            // Crear nota
            container.find('#int-btn-crear-nota').on('click', function () {
                const texto = container.find('#int-nueva-nota-input').val().trim();
                if (!texto) {
                    Espo.Ui.warning('Escribe una observación primero');
                    return;
                }
                self.crearNota(texto);
            });
        },

        guardarCampo: function (campo, valor, fieldEl) {
            const self = this;

            let endpoint = 'Usuarios/action/guardarCampo';
            let body = { userId: this.userId, campo: campo, valor: valor };

            if (campo === 'email') {
                endpoint = 'Usuarios/action/guardarEmail';
                body = { userId: this.userId, valor: valor };
            } else if (campo === 'phone') {
                endpoint = 'Usuarios/action/guardarTelefono';
                body = { userId: this.userId, valor: valor };
            }

            Espo.Ajax.postRequest(endpoint, body)
                .then(function (response) {
                    if (response.success) {
                        let displayVal = valor;
                        if (campo === 'c_tipode_carnet') {
                            displayVal = valor === '1' ? 'Asesor' : 'Asesor Certificado';
                        }
                        if (campo === 'gender') {
                            displayVal = valor === 'Male' ? 'Masculino' : 'Femenino';
                        }

                        fieldEl.find('.int-field-view-mode .int-field-value')
                            .text(displayVal)
                            .removeClass('empty');
                        fieldEl.find('.int-field-view-mode').removeClass('hidden');
                        fieldEl.find('.int-field-edit-mode').removeClass('active');

                        Espo.Ui.success('Campo actualizado correctamente');
                    } else {
                        Espo.Ui.error(response.error || 'Error al guardar');
                    }
                })
                .catch(function () {
                    Espo.Ui.error('Error de conexión');
                });
        },

        crearNota: function (texto) {
            const self = this;
            const btn = this.$el.find('#int-btn-crear-nota');
            btn.prop('disabled', true).html('Publicando...');

            Espo.Ajax.postRequest('Usuarios/action/crearNota', {
                userId: this.userId,
                post: texto
            })
            .then(function (response) {
                if (response.success) {
                    self.$el.find('#int-nueva-nota-input').val('');
                    const notasLista = self.$el.find('#int-notas-lista');
                    const emptyMsg = notasLista.find('.int-notas-empty');
                    if (emptyMsg.length) emptyMsg.remove();
                    notasLista.prepend(self.renderNotaItem(response.nota));
                    Espo.Ui.success('Observación publicada');
                } else {
                    Espo.Ui.error(response.error || 'Error al publicar');
                }
            })
            .catch(function () {
                Espo.Ui.error('Error de conexión');
            })
            .finally(function () {
                btn.prop('disabled', false).html('<i class="fas fa-paper-plane"></i> Publicar');
            });
        },

        subirAvatar: function (file) {
            Espo.Ui.info('Función de subida de foto en desarrollo');
        },

        mostrarError: function (msg) {
            this.$el.find('#perfil-container').html(`
                <div class="int-alert int-alert-danger">
                    <i class="fas fa-exclamation-circle"></i> ${msg || 'Error desconocido'}
                </div>`);
        },

        escapeHtml: function (text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = String(text);
            return div.innerHTML;
        }
    });
});