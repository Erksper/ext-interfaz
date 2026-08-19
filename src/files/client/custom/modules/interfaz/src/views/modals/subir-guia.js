define("interfaz:views/modals/subir-guia", ["views/modal"], function (Dep) {
    return Dep.extend({
        template: "interfaz:modals/subir-guia",

        cssName: "int-modal-subir-guia",

        header: "Subir nueva guía",

        backdrop: true,

        subiendo: false,

        setup: function () {
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
            const self = this;

            this.$el.find("#int-guia-file").on("change", function () {
                const file = this.files && this.files[0];
                const nombreEl = self.$el.find("#int-guia-file-name");

                if (!file) {
                    nombreEl.text("");
                    return;
                }

                if (file.type !== "application/pdf") {
                    Espo.Ui.error("Solo se permiten archivos PDF");
                    $(this).val("");
                    nombreEl.text("");
                    return;
                }

                nombreEl.text(file.name);
            });
        },

        actionGuardar: function () {
            if (this.subiendo) return;

            const nombre = (this.$el.find("#int-guia-nombre").val() || "").trim();
            const descripcion = (this.$el.find("#int-guia-descripcion").val() || "").trim();
            const fileInput = this.$el.find("#int-guia-file").get(0);
            const file = fileInput && fileInput.files && fileInput.files[0];

            if (!nombre) {
                Espo.Ui.error("El nombre es obligatorio");
                return;
            }

            if (!file) {
                Espo.Ui.error("Debes seleccionar un archivo PDF");
                return;
            }

            if (file.type !== "application/pdf") {
                Espo.Ui.error("Solo se permiten archivos PDF");
                return;
            }

            this.subirArchivo(nombre, descripcion, file);
        },

        subirArchivo: function (nombre, descripcion, file) {
            const self = this;

            this.subiendo = true;
            this.disableButton("guardar");
            Espo.Ui.notify("Subiendo guía...");

            const formData = new FormData();
            formData.append("file", file);
            formData.append("nombre", nombre);
            formData.append("descripcion", descripcion);

            const xhr = new XMLHttpRequest();
            xhr.open("POST", "api/v1/Guias/action/crear", true);

            const token = (typeof Espo !== "undefined" && Espo.Ajax && Espo.Ajax.getCsrfToken)
                ? Espo.Ajax.getCsrfToken() : null;
            if (token) xhr.setRequestHeader("X-Csrf-Token", token);

            xhr.onload = function () {
                self.subiendo = false;
                self.enableButton("guardar");

                let response;
                try {
                    response = JSON.parse(xhr.responseText);
                } catch (e) {
                    Espo.Ui.error("Error al procesar la respuesta del servidor");
                    return;
                }

                if (response.success) {
                    self.trigger("subida", response.guia);
                } else {
                    Espo.Ui.error(response.error || "Error al subir la guía");
                }
            };

            xhr.onerror = function () {
                self.subiendo = false;
                self.enableButton("guardar");
                Espo.Ui.error("Error de conexión al subir la guía");
            };

            xhr.send(formData);
        },

        disableButton: function (name) {
            this.$el.find('button[data-name="' + name + '"]').addClass("disabled").attr("disabled", "disabled");
        },

        enableButton: function (name) {
            this.$el.find('button[data-name="' + name + '"]').removeClass("disabled").removeAttr("disabled");
        }
    });
});
