define("interfaz:views/modals/editar-copy", ["views/modal"], function (Dep) {
    return Dep.extend({
        template: "interfaz:modals/editar-copy",

        cssName: "int-modal-editar-copy",

        header: "Editar copy",

        backdrop: true,

        guardando: false,
        rolesDisponibles: [],

        setup: function () {
            this.copy = this.options.copy || {};
            this.rolesActuales = this.copy.roles || [];

            this.buttonList = [
                {
                    name: "guardar",
                    label: "Guardar cambios",
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
            const self = this;

            this.$el.find("#int-copy-nombre").val(this.copy.nombre || "");
            this.$el.find("#int-copy-descripcion").val(this.copy.descripcion || "");

            if (this.copy.archivoNombre) {
                this.$el.find("#int-copy-archivo-actual").text("Archivo actual: " + this.copy.archivoNombre);
            }

            this.$el.find("#int-copy-file").on("change", function () {
                const file = this.files && this.files[0];
                const nombreEl = self.$el.find("#int-copy-file-name");
                nombreEl.text(file ? file.name : "");
            });

            this.$el.find("#int-copy-roles-toggle-todos").on("click", function () {
                self.toggleTodosLosRoles();
            });

            this.cargarRoles();
        },

        cargarRoles: function () {
            const self = this;
            const $lista = this.$el.find("#int-copy-roles-lista");

            Espo.Ajax.getRequest("Usuarios/action/getRolesDisponibles")
                .then(function (response) {
                    if (!response.success) {
                        $lista.html('<div class="int-alert int-alert-danger">' +
                            (response.error || 'No se pudieron cargar los roles') + '</div>');
                        return;
                    }

                    self.rolesDisponibles = response.data;
                    self.renderRoles();
                })
                .catch(function () {
                    $lista.html('<div class="int-alert int-alert-danger">Error de conexión</div>');
                });
        },

        renderRoles: function () {
            const self = this;
            const $lista = this.$el.find("#int-copy-roles-lista");

            if (this.rolesDisponibles.length === 0) {
                $lista.html('<p class="int-notas-empty">No hay roles configurados en el sistema</p>');
                return;
            }

            let html = '';
            this.rolesDisponibles.forEach(function (rol) {
                const checked = self.rolesActuales.indexOf(rol.name) !== -1 ? 'checked' : '';
                html += `
                    <label class="int-rol-check-row-copy">
                        <input type="checkbox" class="int-copy-rol-checkbox" value="${self.escapeHtml(rol.name)}" ${checked}>
                        <span>${self.escapeHtml(rol.name)}</span>
                    </label>
                `;
            });

            $lista.html(html);
        },

        toggleTodosLosRoles: function () {
            const $checks = this.$el.find(".int-copy-rol-checkbox");
            const todosMarcados = $checks.length > 0 && $checks.filter(':checked').length === $checks.length;
            $checks.prop('checked', !todosMarcados);
        },

        actionGuardar: function () {
            if (this.guardando) return;

            const nombre = (this.$el.find("#int-copy-nombre").val() || "").trim();
            const descripcion = (this.$el.find("#int-copy-descripcion").val() || "").trim();
            const fileInput = this.$el.find("#int-copy-file").get(0);
            const file = fileInput && fileInput.files && fileInput.files[0];

            const roles = this.$el.find(".int-copy-rol-checkbox:checked")
                .map(function () { return $(this).val(); }).get();

            if (!nombre) {
                Espo.Ui.error("El nombre es obligatorio");
                return;
            }

            if (roles.length === 0) {
                Espo.Ui.error("Selecciona al menos un rol que pueda ver este documento");
                return;
            }

            this.guardarCambios(nombre, descripcion, file, roles);
        },

        guardarCambios: function (nombre, descripcion, file, roles) {
            const self = this;

            this.guardando = true;
            this.disableButton("guardar");
            Espo.Ui.notify("Guardando cambios...");

            const formData = new FormData();
            formData.append("id", this.copy.id);
            formData.append("nombre", nombre);
            formData.append("descripcion", descripcion);
            formData.append("roles", roles.join(","));
            if (file) {
                formData.append("file", file);
            }

            const xhr = new XMLHttpRequest();
            xhr.open("POST", "api/v1/Copys/action/actualizar", true);

            const token = (typeof Espo !== "undefined" && Espo.Ajax && Espo.Ajax.getCsrfToken)
                ? Espo.Ajax.getCsrfToken() : null;
            if (token) xhr.setRequestHeader("X-Csrf-Token", token);

            xhr.onload = function () {
                self.guardando = false;
                self.enableButton("guardar");

                let response;
                try {
                    response = JSON.parse(xhr.responseText);
                } catch (e) {
                    Espo.Ui.error("Error al procesar la respuesta del servidor");
                    return;
                }

                if (response.success) {
                    self.trigger("actualizado", response.copy);
                } else {
                    Espo.Ui.error(response.error || "Error al guardar los cambios");
                }
            };

            xhr.onerror = function () {
                self.guardando = false;
                self.enableButton("guardar");
                Espo.Ui.error("Error de conexión al guardar los cambios");
            };

            xhr.send(formData);
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
