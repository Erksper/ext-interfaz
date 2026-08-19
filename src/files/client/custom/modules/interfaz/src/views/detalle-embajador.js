define("interfaz:views/detalle-embajador", ["view"], function (Dep) {
    return Dep.extend({
        template: "interfaz:detalle-embajador",

        setup: function () {
            this.embajadorId = this.options.embajadorId;
            this.data = null;
            this.permisos = {
                esAdmin: false, esCasaNacional: false,
                esGerente: false, esDirector: false, esCoordinador: false
            };
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
                            esCasaNacional: response.data.esCasaNacional,
                            esGerente: response.data.esGerente,
                            esDirector: response.data.esDirector,
                            esCoordinador: response.data.esCoordinador
                        };
                    }
                    self.cargarDetalle();
                })
                .catch(function () {
                    self.cargarDetalle();
                });
        },

        cargarDetalle: function () {
            const self = this;
            Espo.Ajax.getRequest("Embajadores/action/getDetalle", {
                embajadorId: this.embajadorId
            })
            .then(function (response) {
                if (response.success) {
                    self.data = response.data;
                    self.renderDetalle(response.data);
                } else {
                    self.mostrarError(response.error);
                }
            })
            .catch(function () {
                self.mostrarError('Error de conexión');
            });
        },

        renderDetalle: function (d) {
            const self = this;
            const container = this.$el.find('#detalle-container');

            const nombre = [d.firstName, d.lastName].filter(Boolean).join(' ') || '—';
            const iniciales = nombre.substring(0, 2).toUpperCase();

            const avatarHtml = d.photoUrl
                ? `<img src="${d.photoUrl}" class="int-avatar-img" alt="${this.escapeHtml(nombre)}"
                       onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                   <div class="int-avatar-placeholder" style="display:none;">${iniciales}</div>`
                : `<div class="int-avatar-placeholder">${iniciales}</div>`;

            const editAvatarBtn = `<label class="int-avatar-edit-btn" title="Cambiar foto" for="int-avatar-file-input">
                       <i class="fas fa-camera"></i>
                   </label>
                   <input type="file" id="int-avatar-file-input" accept="image/*">`;

            const statusMap = {
                '0': { label: 'Pendiente',  color: '#3498db' },
                '1': { label: 'En proceso', color: '#f39c12' },
                '2': { label: 'Activo',     color: '#27ae60' },
                '3': { label: 'Inactivo',   color: '#e74c3c' }
            };
            const st = statusMap[d.status] || { label: d.status || '—', color: '#666' };
            const puedeEditarStatus = !!(this.permisos.esAdmin || this.permisos.esCasaNacional
                || this.permisos.esGerente || this.permisos.esDirector || this.permisos.esCoordinador);

            const statusOptions = Object.keys(statusMap).map(function (key) {
                return `<option value="${key}" ${key === String(d.status) ? 'selected' : ''}>${statusMap[key].label}</option>`;
            }).join('');

            const statusHtml = puedeEditarStatus
                ? `<span class="int-status-view" id="int-status-view">
                       <span class="int-badge" style="background:${st.color};color:white;">${this.escapeHtml(st.label)}</span>
                       <button class="int-field-edit-btn" id="int-btn-editar-status" title="Cambiar estatus">
                           <i class="fas fa-pencil-alt"></i>
                       </button>
                   </span>
                   <span class="int-status-edit hidden" id="int-status-edit">
                       <select id="int-status-select" class="int-form-control">${statusOptions}</select>
                       <button class="int-field-save-btn" id="int-btn-guardar-status">Guardar</button>
                       <button class="int-field-cancel-btn" id="int-btn-cancelar-status">Cancelar</button>
                   </span>`
                : `<span class="int-badge" style="background:${st.color};color:white;">${this.escapeHtml(st.label)}</span>`;

            const qrHtml = d.qrImageUrl
                ? `<a href="${this.escapeHtml(d.qr || '#')}" target="_blank" title="Abrir URL del QR">
                       <img src="${this.escapeHtml(d.qrImageUrl)}" class="int-qr-img" alt="Código QR">
                   </a>`
                : '<span class="int-field-value empty">No disponible</span>';

            const docHtml = this.renderDocumentos(d.documentos || []);
            const notasHtml = this.renderNotas(d.notas || []);

            const html = `
            <div class="int-page-header">
                <div class="int-header-left">
                    <div class="int-header-icon">
                        <i class="fas fa-address-card"></i>
                    </div>
                    <div>
                        <h1 class="int-page-title">Detalle de Embajador</h1>
                        <p class="int-page-subtitle">${this.escapeHtml(nombre)}</p>
                    </div>
                </div>
                <div class="int-header-right">
                    <button class="int-btn int-btn-secondary" id="btn-volver">
                        <i class="fas fa-arrow-left"></i> Volver a la lista
                    </button>
                </div>
            </div>

            <div class="int-perfil-top">

                <div class="int-avatar-card">
                    <div class="int-avatar-wrap">
                        ${avatarHtml}
                        ${editAvatarBtn}
                    </div>
                    <div class="int-avatar-username-label">Código</div>
                    <div class="int-avatar-username">${this.escapeHtml(d.code || '—')}</div>
                    <div class="int-avatar-badges">
                        ${statusHtml}
                    </div>
                </div>

                <div class="int-info-card">
                    <h3 class="int-info-card-title">
                        <i class="fas fa-id-card"></i> Datos del Embajador
                    </h3>
                    <div class="int-fields-grid">
                        ${this.renderField('Nombre', 'first_name', d.firstName, true)}
                        ${this.renderField('Apellido', 'last_name', d.lastName, true)}
                        ${this.renderField('Cédula', 'cedula', d.cedula, true)}
                        ${this.renderField('Correo electrónico', 'email', d.emailAddress, true, 'email')}
                        ${this.renderField('Teléfono', 'phone', d.phoneNumber, true)}
                        ${this.renderField('Calle', 'address_street', d.addressStreet, true)}
                        ${this.renderField('Ciudad', 'address_city', d.addressCity, true)}
                        ${this.renderField('Estado/Distrito', 'address_state', d.addressState, true)}
                        ${this.renderField('País', 'address_country', d.addressCountry, true)}
                        ${this.renderField('Código Postal', 'address_postal_code', d.addressPostalCode, true)}
                        ${this.renderFieldReadonly('Total de referidos', d.recordCount !== null ? String(d.recordCount) : null)}
                        ${this.renderFieldReadonly('Carnet', d.carnet, 'link')}
                        ${this.renderField('Porcentaje del embajador', 'porcentaje', d.porcentaje, true, 'porcentaje')}
                        ${this.renderField('Usuario', 'c_usuario', d.usuario, true)}
                        ${this.renderPasswordField(d.passwordEstablecida)}
                    </div>
                    ${this.renderFieldText('Ocupación', 'description', d.description, true)}
                    <div class="int-field" style="margin-top:16px;">
                        <span class="int-field-label">Documentos</span>
                        <div class="int-docs-wrap" id="int-docs-lista">
                            ${docHtml}
                        </div>
                        <div style="margin-top:10px;">
                            <label class="int-btn int-btn-secondary" for="int-doc-file-input" style="cursor:pointer;display:inline-flex;">
                                <i class="fas fa-paperclip"></i> Adjuntar documento
                            </label>
                            <input type="file" id="int-doc-file-input" style="display:none;">
                        </div>
                    </div>
                </div>
            </div>

            <div class="int-info-card">
                <h3 class="int-info-card-title">
                    <i class="fas fa-building"></i> Datos de la Oficina
                </h3>
                <div class="int-fields-grid">
                    <div class="int-field">
                        <span class="int-field-label">Equipo / Oficina</span>
                        <div class="int-tags-wrap">
                            ${d.teamName
                                ? `<span class="int-tag">${this.escapeHtml(d.teamName)}</span>`
                                : '<span class="int-field-value empty">Sin equipo</span>'}
                        </div>
                    </div>
                    <div class="int-field">
                        <span class="int-field-label">Asesor Asignado</span>
                        <div class="int-tags-wrap">
                            ${d.assignedUserName
                                ? `<span class="int-tag">${this.escapeHtml(d.assignedUserName)}</span>`
                                : '<span class="int-field-value empty">Sin asignar</span>'}
                        </div>
                    </div>
                </div>
                <div class="int-field" style="margin-top:16px;">
                    <span class="int-field-label">Código QR</span>
                    <div class="int-qr-container">
                        ${qrHtml}
                    </div>
                </div>
            </div>

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
        },

        renderDocumentos: function (documentos) {
            if (!documentos.length) {
                return '<span class="int-field-value empty" id="int-docs-empty">Sin documentos</span>';
            }
            return documentos.map(doc => this.renderDocItem(doc)).join('');
        },

        renderDocItem: function (doc) {
            return `
            <div class="int-doc-item-wrap" data-doc-id="${doc.id}">
                <a href="${this.escapeHtml(doc.url)}" target="_blank" class="int-doc-item">
                    <i class="fas fa-file"></i>
                    <span>${this.escapeHtml(doc.name)}</span>
                </a>
                <button class="int-doc-remove-btn" data-doc-id="${doc.id}" title="Eliminar documento">
                    <i class="fas fa-times"></i>
                </button>
            </div>`;
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
                ? `<img src="${n.autorAvatar}" alt=""
                       style="width:100%;height:100%;object-fit:cover;">`
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

        renderField: function (label, campo, valor, editable, tipo) {
            const displayVal = (valor !== null && valor !== undefined && valor !== '')
                ? `<span class="int-field-value">${this.escapeHtml(String(valor))}${tipo === 'porcentaje' ? '%' : ''}</span>`
                : `<span class="int-field-value empty">No especificado</span>`;

            const editBtn = editable
                ? `<button class="int-field-edit-btn" data-campo="${campo}" title="Editar">
                       <i class="fas fa-pencil-alt"></i>
                   </button>`
                : '';

            let inputAttrs = '';
            let inputType = 'text';

            if (tipo === 'email') {
                inputType = 'email';
            } else if (tipo === 'porcentaje') {
                inputType = 'number';
                inputAttrs = 'min="0" max="35" step="0.1"';
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
                    <input type="${inputType}" class="int-field-input" data-campo="${campo}"
                        value="${this.escapeHtml(String(valor || ''))}" ${inputAttrs}>
                    <div class="int-field-actions">
                        <button class="int-field-save-btn" data-campo="${campo}">Guardar</button>
                        <button class="int-field-cancel-btn" data-campo="${campo}">Cancelar</button>
                    </div>
                </div>` : ''}
            </div>`;
        },

        renderFieldText: function (label, campo, valor, editable) {
            const displayVal = valor
                ? `<span class="int-field-value" style="white-space:pre-wrap;">${this.escapeHtml(String(valor))}</span>`
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

        renderPasswordField: function (establecida) {
            // Campo de solo-escritura: nunca se muestra el valor real (ni el hash),
            // solo si está establecida o no. Al guardar se manda como texto plano al
            // endpoint especial guardarPassword, que hashea vía el Formula del back.
            const displayVal = establecida
                ? '<span class="int-field-value">•••••••• (establecida)</span>'
                : '<span class="int-field-value empty">No establecida</span>';

            return `
            <div class="int-field" data-campo="c_password">
                <span class="int-field-label">Contraseña</span>
                <div class="int-field-view-mode">
                    <div class="int-field-value-wrap">
                        ${displayVal}
                        <button class="int-field-edit-btn" data-campo="c_password" title="Cambiar contraseña">
                            <i class="fas fa-pencil-alt"></i>
                        </button>
                    </div>
                </div>
                <div class="int-field-edit-mode">
                    <input type="password" class="int-field-input" data-campo="c_password"
                        placeholder="Nueva contraseña" autocomplete="new-password">
                    <div class="int-field-actions">
                        <button class="int-field-save-btn" data-campo="c_password">Guardar</button>
                        <button class="int-field-cancel-btn" data-campo="c_password">Cancelar</button>
                    </div>
                </div>
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
            const container = this.$el.find('#detalle-container');

            container.find('#btn-volver').on('click', function () {
                self.getRouter().navigate('#ListaEmbajadores', { trigger: true });
            });

            container.on('click', '.int-field-edit-btn', function () {
                const campo = $(this).data('campo');
                const fieldEl = container.find(`.int-field[data-campo="${campo}"]`);
                fieldEl.find('.int-field-view-mode').addClass('hidden');
                fieldEl.find('.int-field-edit-mode').addClass('active');
                fieldEl.find('.int-field-input').first().focus();
            });

            container.on('click', '.int-field-cancel-btn', function () {
                const campo = $(this).data('campo');
                const fieldEl = container.find(`.int-field[data-campo="${campo}"]`);
                fieldEl.find('.int-field-view-mode').removeClass('hidden');
                fieldEl.find('.int-field-edit-mode').removeClass('active');
            });

            container.on('click', '.int-field-save-btn[data-campo]', function () {
                const campo = $(this).data('campo');
                const fieldEl = container.find(`.int-field[data-campo="${campo}"]`);
                const valor = fieldEl.find('.int-field-input').val();
                self.guardarCampo(campo, valor, fieldEl);
            });

            // Estatus (solo gestión/casa nacional/admin ven este botón)
            container.on('click', '#int-btn-editar-status', function () {
                container.find('#int-status-view').addClass('hidden');
                container.find('#int-status-edit').removeClass('hidden');
            });

            container.on('click', '#int-btn-cancelar-status', function () {
                container.find('#int-status-edit').addClass('hidden');
                container.find('#int-status-view').removeClass('hidden');
            });

            container.on('click', '#int-btn-guardar-status', function () {
                self.guardarStatus(container.find('#int-status-select').val());
            });

            container.find('#int-btn-crear-nota').on('click', function () {
                const texto = container.find('#int-nueva-nota-input').val().trim();
                if (!texto) {
                    Espo.Ui.warning('Escribe una observación primero');
                    return;
                }
                self.crearNota(texto);
            });

            // Subida de foto
            container.find('#int-avatar-file-input').on('change', function (e) {
                const file = e.target.files[0];
                if (file) self.subirFoto(file);
            });

            // Subida de documento
            container.find('#int-doc-file-input').on('change', function (e) {
                const file = e.target.files[0];
                if (file) self.subirDocumento(file);
                $(this).val('');
            });

            // Eliminar documento
            container.on('click', '.int-doc-remove-btn', function () {
                const docId = $(this).data('doc-id');
                self.eliminarDocumento(docId, $(this).closest('.int-doc-item-wrap'));
            });
        },

        guardarCampo: function (campo, valor, fieldEl) {
            const self = this;

            let endpoint = 'Embajadores/action/guardarCampo';
            let body = { embajadorId: this.embajadorId, campo: campo, valor: valor };

            if (campo === 'email') {
                const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
                if (!emailRegex.test(valor.trim())) {
                    Espo.Ui.error('Ingrese un correo electrónico válido');
                    return;
                }
                endpoint = 'Embajadores/action/guardarEmail';
                body = { embajadorId: this.embajadorId, valor: valor };
            } else if (campo === 'phone') {
                endpoint = 'Embajadores/action/guardarTelefono';
                body = { embajadorId: this.embajadorId, valor: valor };
            } else if (campo === 'porcentaje') {
                const num = parseFloat(valor);
                if (valor !== '' && (isNaN(num) || num < 0 || num > 35)) {
                    Espo.Ui.error('El porcentaje debe ser un número entre 0% y 35%, con máximo 1 decimal');
                    return;
                }
                if (valor !== '') {
                    valor = Math.round(num * 10) / 10;
                    body.valor = valor;
                }
            } else if (campo === 'c_password') {
                if (!valor || valor.length < 4) {
                    Espo.Ui.error('La contraseña debe tener al menos 4 caracteres');
                    return;
                }
                endpoint = 'Embajadores/action/guardarPassword';
                body = { embajadorId: this.embajadorId, valor: valor };
            }

            Espo.Ajax.postRequest(endpoint, body)
                .then(function (response) {
                    if (response.success) {
                        let displayVal = valor;
                        if (campo === 'porcentaje' && valor !== '') {
                            displayVal = valor + '%';
                        }
                        if (campo === 'c_password') {
                            displayVal = '•••••••• (establecida)';
                        }

                        fieldEl.find('.int-field-view-mode .int-field-value')
                            .text(displayVal || 'No especificado')
                            .toggleClass('empty', !displayVal);
                        fieldEl.find('.int-field-view-mode').removeClass('hidden');
                        fieldEl.find('.int-field-edit-mode').removeClass('active');
                        fieldEl.find('.int-field-input').val('');

                        Espo.Ui.success(campo === 'c_password' ? 'Contraseña actualizada' : 'Campo actualizado correctamente');
                    } else {
                        Espo.Ui.error(response.error || 'Error al guardar');
                    }
                })
                .catch(function () {
                    Espo.Ui.error('Error de conexión');
                });
        },

        subirFoto: function (file) {
            Espo.Ui.notify('Subiendo foto...');
            this.subirFotoXhr(file);
        },

        guardarStatus: function (nuevoStatus) {
            const self = this;
            const container = this.$el.find('#detalle-container');

            const statusMap = {
                '0': { label: 'Pendiente',  color: '#3498db' },
                '1': { label: 'En proceso', color: '#f39c12' },
                '2': { label: 'Activo',     color: '#27ae60' },
                '3': { label: 'Inactivo',   color: '#e74c3c' }
            };

            Espo.Ajax.postRequest('Embajadores/action/guardarCampo', {
                embajadorId: this.embajadorId,
                campo: 'status',
                valor: nuevoStatus
            })
            .then(function (response) {
                if (response.success) {
                    const st = statusMap[nuevoStatus] || { label: nuevoStatus, color: '#666' };
                    container.find('#int-status-view .int-badge')
                        .css('background', st.color)
                        .text(st.label);
                    container.find('#int-status-edit').addClass('hidden');
                    container.find('#int-status-view').removeClass('hidden');
                    if (self.data) self.data.status = nuevoStatus;
                    Espo.Ui.success('Estatus actualizado');
                } else {
                    Espo.Ui.error(response.error || 'No se pudo actualizar el estatus');
                }
            })
            .catch(function () {
                Espo.Ui.error('Error de conexión al actualizar el estatus');
            });
        },

        subirFotoXhr: function (file) {
            const self = this;
            const formData = new FormData();
            formData.append('file', file);
            formData.append('embajadorId', this.embajadorId);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'api/v1/Embajadores/action/subirFoto?embajadorId=' + this.embajadorId, true);

            const token = (typeof Espo !== 'undefined' && Espo.Ajax && Espo.Ajax.getCsrfToken)
                ? Espo.Ajax.getCsrfToken() : null;
            if (token) xhr.setRequestHeader('X-Csrf-Token', token);

            xhr.onload = function () {
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
                        const avatarWrap = self.$el.find('.int-avatar-wrap');
                        avatarWrap.find('img.int-avatar-img, .int-avatar-placeholder').remove();
                        avatarWrap.prepend(
                            `<img src="${response.photoUrl}" class="int-avatar-img" alt="Foto">`
                        );
                        Espo.Ui.success('Foto actualizada correctamente');
                    } else {
                        Espo.Ui.error(response.error || 'Error al subir la foto');
                    }
                } catch (e) {
                    Espo.Ui.error('Error al procesar la respuesta');
                }
            };

            xhr.onerror = function () {
                Espo.Ui.error('Error de conexión al subir la foto');
            };

            xhr.send(formData);
        },

        subirDocumento: function (file) {
            const self = this;
            const formData = new FormData();
            formData.append('file', file);
            formData.append('embajadorId', this.embajadorId);

            Espo.Ui.notify('Subiendo documento...');

            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'api/v1/Embajadores/action/subirDocumento?embajadorId=' + this.embajadorId, true);

            const token = (typeof Espo !== 'undefined' && Espo.Ajax && Espo.Ajax.getCsrfToken)
                ? Espo.Ajax.getCsrfToken() : null;
            if (token) xhr.setRequestHeader('X-Csrf-Token', token);

            xhr.onload = function () {
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
                        const docsLista = self.$el.find('#int-docs-lista');
                        const emptyMsg = docsLista.find('#int-docs-empty');
                        if (emptyMsg.length) emptyMsg.remove();
                        docsLista.append(self.renderDocItem(response.documento));
                        Espo.Ui.success('Documento adjuntado correctamente');
                    } else {
                        Espo.Ui.error(response.error || 'Error al subir el documento');
                    }
                } catch (e) {
                    Espo.Ui.error('Error al procesar la respuesta');
                }
            };

            xhr.onerror = function () {
                Espo.Ui.error('Error de conexión al subir el documento');
            };

            xhr.send(formData);
        },

        eliminarDocumento: function (docId, $wrapEl) {
            const self = this;

            Espo.Ajax.postRequest('Embajadores/action/eliminarDocumento', {
                documentoId: docId
            })
            .then(function (response) {
                if (response.success) {
                    $wrapEl.remove();
                    const docsLista = self.$el.find('#int-docs-lista');
                    if (docsLista.find('.int-doc-item-wrap').length === 0) {
                        docsLista.html('<span class="int-field-value empty" id="int-docs-empty">Sin documentos</span>');
                    }
                    Espo.Ui.success('Documento eliminado');
                } else {
                    Espo.Ui.error(response.error || 'Error al eliminar el documento');
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

            Espo.Ajax.postRequest('Embajadores/action/crearNota', {
                embajadorId: this.embajadorId,
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

        mostrarError: function (msg) {
            this.$el.find('#detalle-container').html(`
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