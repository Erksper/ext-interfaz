define("interfaz:views/detalle-lead", ["view"], function (Dep) {
    return Dep.extend({
        template: "interfaz:detalle-lead",

        stageOptions: [
            { value: "Prospecting",                       label: "Por Contactar" },
            { value: "Proposed",                           label: "Recopilacion de informacion" },
            { value: "Presented",                          label: "Creacion de Perfil de compra" },
            { value: "Recopilacion de opciones",           label: "Recopilacion de opciones" },
            { value: "Muesta de Opciones",                 label: "Muesta de Opciones" },
            { value: "Visita de propiedad",                label: "Visita de propiedad" },
            { value: "Propuesta por parte del comprador",  label: "Propuesta por parte del comprador" },
            { value: "Aceptacion de propuesta",             label: "Aceptacion de propuesta" },
            { value: "Por cobrar",                          label: "Por cobrar" },
            { value: "Closed Won",                          label: "Cerrado Ganado" },
            { value: "Closed Lost",                         label: "Cerrado Perdido" }
        ],

        interesOptions: [
            { value: "compra", label: "Compra" },
            { value: "venta", label: "Venta" },
            { value: "arrendador", label: "Arrendador" },
            { value: "Desea Alquilar Apartamento", label: "Desea Alquilar Apartamento" }
        ],

        setup: function () {
            this.leadId = this.options.leadId;
            this.data = null;
        },

        afterRender: function () {
            this.cargarDetalle();
        },

        cargarDetalle: function () {
            const self = this;
            Espo.Ajax.getRequest("Leads/action/getDetalle", {
                leadId: this.leadId
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

            const stageColorMap = {
                'Prospecting': '#3498db',
                'Proposed': '#3498db',
                'Presented': '#3498db',
                'Recopilacion de opciones': '#f39c12',
                'Muesta de Opciones': '#f39c12',
                'Visita de propiedad': '#f39c12',
                'Propuesta por parte del comprador': '#9b59b6',
                'Aceptacion de propuesta': '#9b59b6',
                'Por cobrar': '#9b59b6',
                'Closed Won': '#27ae60',
                'Closed Lost': '#e74c3c'
            };
            const stageColor = stageColorMap[d.stage] || '#666';

            const avatarHtml = d.assignedUserAvatar
                ? `<img src="${d.assignedUserAvatar}" class="int-avatar-img" alt="${this.escapeHtml(d.assignedUserName)}"
                       onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                   <div class="int-avatar-placeholder" style="display:none;">
                       ${(d.assignedUserName || '?')[0].toUpperCase()}
                   </div>`
                : `<div class="int-avatar-placeholder">${(d.assignedUserName || '?')[0].toUpperCase()}</div>`;

            const interesLabel = this.interesOptions.find(o => o.value === d.cInteres);
            const stageOptsHtml = this.stageOptions.map(o =>
                `<option value="${o.value}" ${o.value === d.stage ? 'selected' : ''}>${o.label}</option>`
            ).join('');
            const interesOptsHtml = this.interesOptions.map(o =>
                `<option value="${o.value}" ${o.value === d.cInteres ? 'selected' : ''}>${o.label}</option>`
            ).join('');

            const notasHtml = this.renderNotas(d.notas || []);

            const html = `
            <div class="int-page-header">
                <div class="int-header-left">
                    <div class="int-header-icon">
                        <i class="fas fa-bullseye"></i>
                    </div>
                    <div>
                        <h1 class="int-page-title">Detalle de Lead</h1>
                        <p class="int-page-subtitle">${this.escapeHtml(d.name || '—')}</p>
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
                    </div>
                    <div class="int-avatar-username-label">Asesor Asignado</div>
                    <div class="int-avatar-username">${this.escapeHtml(d.assignedUserName || '—')}</div>
                    <div class="int-avatar-badges">
                        <span class="int-badge" style="background:${stageColor};color:white;">
                            ${this.escapeHtml(d.stageLabel || '—')}
                        </span>
                    </div>
                </div>

                <div class="int-info-card">
                    <h3 class="int-info-card-title">
                        <i class="fas fa-id-card"></i> Datos del Lead
                    </h3>
                    <div class="int-fields-grid">
                        ${this.renderField('Nombre', 'name', d.name, true)}
                        ${this.renderSelectField('Estado', 'stage', d.stage, d.stageLabel, stageOptsHtml, true, 'stage')}
                        ${this.renderSelectField('Interés', 'c_interes', d.cInteres, interesLabel ? interesLabel.label : d.cInteres, interesOptsHtml, true)}
                        ${this.renderField('Correo electrónico', 'c_correo', d.correo, true, 'email')}
                        ${this.renderField('Teléfono', 'c_nmero_de_contacto', d.numeroContacto, true)}
                        ${this.renderFieldReadonly('Código', d.codigo)}
                    </div>
                    ${this.renderFieldText('Descripción', 'description', d.description, true)}
                </div>
            </div>

            <div class="int-info-card">
                <h3 class="int-info-card-title">
                    <i class="fas fa-building"></i> Información Adicional
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
                        <span class="int-field-label">Usuario Asignado</span>
                        <div class="int-tags-wrap">
                            ${d.assignedUserName
                                ? `<span class="int-tag">${this.escapeHtml(d.assignedUserName)}</span>`
                                : '<span class="int-field-value empty">Sin asignar</span>'}
                        </div>
                    </div>
                    <div class="int-field">
                        <span class="int-field-label">Embajador</span>
                        <div class="int-tags-wrap">
                            ${d.ambassadorName
                                ? `<span class="int-tag">${this.escapeHtml(d.ambassadorName)}</span>`
                                : '<span class="int-field-value empty">Sin embajador asociado</span>'}
                        </div>
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

        renderField: function (label, campo, valor, editable, tipo) {
            const displayVal = valor
                ? `<span class="int-field-value">${this.escapeHtml(String(valor))}</span>`
                : `<span class="int-field-value empty">No especificado</span>`;

            const editBtn = editable
                ? `<button class="int-field-edit-btn" data-campo="${campo}" title="Editar">
                       <i class="fas fa-pencil-alt"></i>
                   </button>`
                : '';

            const inputType = tipo === 'email' ? 'email' : 'text';

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
                        value="${this.escapeHtml(String(valor || ''))}">
                    <div class="int-field-actions">
                        <button class="int-field-save-btn" data-campo="${campo}">Guardar</button>
                        <button class="int-field-cancel-btn" data-campo="${campo}">Cancelar</button>
                    </div>
                </div>` : ''}
            </div>`;
        },

        renderSelectField: function (label, campo, valorRaw, valorLabel, optionsHtml, editable, endpointType) {
            const displayVal = valorLabel
                ? `<span class="int-field-value">${this.escapeHtml(String(valorLabel))}</span>`
                : `<span class="int-field-value empty">No especificado</span>`;

            const editBtn = editable
                ? `<button class="int-field-edit-btn" data-campo="${campo}" title="Editar">
                       <i class="fas fa-pencil-alt"></i>
                   </button>`
                : '';

            return `
            <div class="int-field" data-campo="${campo}" data-endpoint-type="${endpointType || ''}">
                <span class="int-field-label">${label}</span>
                <div class="int-field-view-mode">
                    <div class="int-field-value-wrap">
                        ${displayVal}
                        ${editBtn}
                    </div>
                </div>
                ${editable ? `
                <div class="int-field-edit-mode">
                    <select class="int-field-input" data-campo="${campo}">
                        ${optionsHtml}
                    </select>
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

        renderFieldReadonly: function (label, valor) {
            return `
            <div class="int-field">
                <span class="int-field-label">${label}</span>
                <div class="int-field-value-wrap">
                    ${valor
                        ? `<span class="int-field-value">${this.escapeHtml(valor)}</span>`
                        : '<span class="int-field-value empty">No especificado</span>'}
                </div>
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

        setupEvents: function () {
            const self = this;
            const container = this.$el.find('#detalle-container');

            container.find('#btn-volver').on('click', function () {
                self.getRouter().navigate('#ListaLeads', { trigger: true });
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

            // Stage usa endpoint dedicado
            if (campo === 'stage') {
                Espo.Ajax.postRequest('Leads/action/guardarStage', {
                    leadId: this.leadId,
                    stage: valor
                })
                .then(function (response) {
                    if (response.success) {
                        const stageColorMap = {
                            'Prospecting': '#3498db', 'Proposed': '#3498db', 'Presented': '#3498db',
                            'Recopilacion de opciones': '#f39c12', 'Muesta de Opciones': '#f39c12', 'Visita de propiedad': '#f39c12',
                            'Propuesta por parte del comprador': '#9b59b6', 'Aceptacion de propuesta': '#9b59b6', 'Por cobrar': '#9b59b6',
                            'Closed Won': '#27ae60', 'Closed Lost': '#e74c3c'
                        };
                        const color = stageColorMap[valor] || '#666';

                        fieldEl.find('.int-field-view-mode .int-field-value')
                            .text(response.stageLabel)
                            .removeClass('empty');
                        fieldEl.find('.int-field-view-mode').removeClass('hidden');
                        fieldEl.find('.int-field-edit-mode').removeClass('active');

                        self.$el.find('.int-avatar-badges .int-badge')
                            .text(response.stageLabel)
                            .css('background', color);

                        Espo.Ui.success('Estado actualizado correctamente');
                    } else {
                        Espo.Ui.error(response.error || 'Error al guardar');
                    }
                })
                .catch(function () {
                    Espo.Ui.error('Error de conexión');
                });
                return;
            }

            // Interés es un select con su propio label
            if (campo === 'c_interes') {
                const label = fieldEl.find(`option[value="${CSS.escape(valor)}"]`).text();
                Espo.Ajax.postRequest('Leads/action/guardarCampo', {
                    leadId: this.leadId,
                    campo: campo,
                    valor: valor
                })
                .then(function (response) {
                    if (response.success) {
                        fieldEl.find('.int-field-view-mode .int-field-value')
                            .text(label)
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
                return;
            }

            // Validación de correo
            if (campo === 'c_correo' && valor) {
                const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
                if (!emailRegex.test(valor.trim())) {
                    Espo.Ui.error('Ingrese un correo electrónico válido');
                    return;
                }
            }

            Espo.Ajax.postRequest('Leads/action/guardarCampo', {
                leadId: this.leadId,
                campo: campo,
                valor: valor
            })
            .then(function (response) {
                if (response.success) {
                    fieldEl.find('.int-field-view-mode .int-field-value')
                        .text(valor || 'No especificado')
                        .toggleClass('empty', !valor);
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

            Espo.Ajax.postRequest('Leads/action/crearNota', {
                leadId: this.leadId,
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