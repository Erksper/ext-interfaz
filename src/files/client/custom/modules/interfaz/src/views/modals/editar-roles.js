define("interfaz:views/modals/editar-roles", ["views/modal"], function (Dep) {
    return Dep.extend({
        template: "interfaz:modals/editar-roles",

        cssName: "int-modal-editar-roles",

        header: "Editar roles del usuario",

        backdrop: true,

        guardando: false,

        setup: function () {
            this.userId = this.options.userId;
            this.rolesActualesIds = (this.options.rolesActuales || []).map(function (r) { return r.id; });
            this.rolesDisponibles = [];

            this.buttonList = [
                {
                    name: "guardar",
                    label: "Guardar",
                    style: "primary",
                    onClick: () => this.actionGuardar()
                },
                {
                    name: "cancel",
                    label: "Cancelar",
                    onClick: () => this.close()
                }
            ];
        },

        afterRender: function () {
            this.cargarRoles();
        },

        cargarRoles: function () {
            const self = this;
            const $lista = this.$el.find("#int-roles-lista");

            Espo.Ajax.getRequest("Usuarios/action/getRolesDisponibles")
                .then(function (response) {
                    if (!response.success) {
                        $lista.html('<div class="int-alert int-alert-danger">' +
                            (response.error || 'No se pudieron cargar los roles') + '</div>');
                        return;
                    }

                    self.rolesDisponibles = response.data;
                    self.renderLista();
                })
                .catch(function () {
                    $lista.html('<div class="int-alert int-alert-danger">Error de conexión</div>');
                });
        },

        renderLista: function () {
            const self = this;
            const $lista = this.$el.find("#int-roles-lista");

            if (this.rolesDisponibles.length === 0) {
                $lista.html('<p class="int-notas-empty">No hay roles configurados en el sistema</p>');
                return;
            }

            let html = '';
            this.rolesDisponibles.forEach(function (rol) {
                const checked = self.rolesActualesIds.indexOf(rol.id) !== -1 ? 'checked' : '';
                html += `
                    <label class="int-rol-check-row">
                        <input type="checkbox" class="int-rol-checkbox" value="${rol.id}" ${checked}>
                        <span>${self.escapeHtml(rol.name)}</span>
                    </label>
                `;
            });

            $lista.html(html);
        },

        actionGuardar: function () {
            if (this.guardando) return;

            const self = this;
            const roleIds = [];

            this.$el.find(".int-rol-checkbox:checked").each(function () {
                roleIds.push($(this).val());
            });

            this.guardando = true;
            this.disableButton("guardar");

            Espo.Ajax.postRequest("Usuarios/action/actualizarRoles", {
                userId: this.userId,
                roleIds: roleIds
            })
            .then(function (response) {
                self.guardando = false;
                self.enableButton("guardar");

                if (response.success) {
                    const nuevosRoles = self.rolesDisponibles.filter(function (r) {
                        return roleIds.indexOf(r.id) !== -1;
                    });
                    self.trigger("actualizado", nuevosRoles);
                } else {
                    Espo.Ui.error(response.error || "No se pudieron guardar los roles");
                }
            })
            .catch(function () {
                self.guardando = false;
                self.enableButton("guardar");
                Espo.Ui.error("Error de conexión al guardar los roles");
            });
        },

        disableButton: function (name) {
            this.$el.find('button[data-name="' + name + '"]').addClass("disabled").attr("disabled", "disabled");
        },

        enableButton: function (name) {
            this.$el.find('button[data-name="' + name + '"]').removeClass("disabled").removeAttr("disabled");
        },

        escapeHtml: function (text) {
            if (!text) return "";
            const div = document.createElement("div");
            div.textContent = text;
            return div.innerHTML;
        }
    });
});
