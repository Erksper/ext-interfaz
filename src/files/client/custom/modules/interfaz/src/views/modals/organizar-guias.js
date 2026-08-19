define("interfaz:views/modals/organizar-guias", ["views/modal"], function (Dep) {
    return Dep.extend({
        template: "interfaz:modals/organizar-guias",

        cssName: "int-modal-organizar-guias",

        header: "Organizar y eliminar guías",

        backdrop: true,

        huboCambios: false,
        guardando: false,

        setup: function () {
            // Copia local editable (no mutamos this.options.guias directamente)
            this.guias = (this.options.guias || []).slice().sort(function (a, b) {
                return (a.orden || 0) - (b.orden || 0);
            });

            this.buttonList = [
                {
                    name: "guardarOrden",
                    label: "Guardar orden",
                    style: "primary",
                    onClick: () => this.actionGuardarOrden()
                },
                {
                    name: "cerrar",
                    label: "Cerrar",
                    onClick: () => this.actionCerrar()
                }
            ];
        },

        afterRender: function () {
            this.renderLista();
        },

        renderLista: function () {
            const self = this;
            const $lista = this.$el.find("#int-organizar-lista");
            const $empty = this.$el.find("#int-organizar-vacio");

            $lista.empty();

            if (this.guias.length === 0) {
                $lista.hide();
                $empty.show();
                return;
            }

            $lista.show();
            $empty.hide();

            this.guias.forEach(function (guia) {
                const $row = $(`
                    <li class="int-organizar-row" draggable="true" data-id="${guia.id}">
                        <i class="fas fa-grip-vertical int-organizar-handle"></i>
                        <span class="int-organizar-nombre">${self.escapeHtml(guia.nombre)}</span>
                        <button type="button" class="int-organizar-eliminar" title="Eliminar guía" data-id="${guia.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </li>
                `);
                $lista.append($row);
            });

            this.attachDragEvents();
            this.attachDeleteEvents();
        },

        attachDragEvents: function () {
            const self = this;
            const container = this.$el.find("#int-organizar-lista").get(0);

            this.$el.find(".int-organizar-row").each(function () {
                const row = this;

                row.addEventListener("dragstart", function () {
                    row.classList.add("dragging");
                });

                row.addEventListener("dragend", function () {
                    row.classList.remove("dragging");
                    self.huboCambios = true;
                });
            });

            container.ondragover = function (e) {
                e.preventDefault();
                const dragging = container.querySelector(".dragging");
                if (!dragging) return;

                const afterElement = self.getDragAfterElement(container, e.clientY);
                if (afterElement == null) {
                    container.appendChild(dragging);
                } else {
                    container.insertBefore(dragging, afterElement);
                }
            };
        },

        getDragAfterElement: function (container, y) {
            const rows = [...container.querySelectorAll(".int-organizar-row:not(.dragging)")];

            return rows.reduce((closest, row) => {
                const box = row.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;

                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: row };
                }

                return closest;
            }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
        },

        attachDeleteEvents: function () {
            const self = this;

            this.$el.find(".int-organizar-eliminar").on("click", function () {
                const id = $(this).data("id");
                const nombre = self.$el.find('.int-organizar-row[data-id="' + id + '"] .int-organizar-nombre').text();

                self.confirmarEliminar(id, nombre);
            });
        },

        confirmarEliminar: function (id, nombre) {
            const self = this;

            if (typeof Espo !== "undefined" && Espo.Ui && Espo.Ui.confirm) {
                Espo.Ui.confirm(
                    '¿Eliminar la guía "' + nombre + '"? Esta acción no se puede deshacer.',
                    { confirmText: "Eliminar", cancelText: "Cancelar" },
                    function () {
                        self.eliminarGuia(id);
                    }
                );
                return;
            }

            if (window.confirm('¿Eliminar la guía "' + nombre + '"? Esta acción no se puede deshacer.')) {
                this.eliminarGuia(id);
            }
        },

        eliminarGuia: function (id) {
            const self = this;

            Espo.Ajax.postRequest("Guias/action/eliminar", { id: id })
                .then(function (response) {
                    if (response.success) {
                        self.$el.find('.int-organizar-row[data-id="' + id + '"]').remove();
                        self.guias = self.guias.filter(function (g) { return g.id !== id; });
                        self.huboCambios = true;

                        if (self.guias.length === 0) {
                            self.$el.find("#int-organizar-lista").hide();
                            self.$el.find("#int-organizar-vacio").show();
                        }

                        Espo.Ui.success("Guía eliminada");
                    } else {
                        Espo.Ui.error(response.error || "No se pudo eliminar la guía");
                    }
                })
                .catch(function () {
                    Espo.Ui.error("Error de conexión al eliminar la guía");
                });
        },

        actionGuardarOrden: function () {
            if (this.guardando) return;

            const self = this;
            const orden = [];

            this.$el.find(".int-organizar-row").each(function (index) {
                orden.push({
                    id: $(this).data("id"),
                    orden: index + 1
                });
            });

            if (orden.length === 0) {
                this.close();
                return;
            }

            this.guardando = true;
            this.disableButton("guardarOrden");

            Espo.Ajax.postRequest("Guias/action/actualizarOrden", { orden: orden })
                .then(function (response) {
                    self.guardando = false;
                    self.enableButton("guardarOrden");

                    if (response.success) {
                        Espo.Ui.success("Orden guardado correctamente");
                        self.trigger("actualizado");
                    } else {
                        Espo.Ui.error(response.error || "No se pudo guardar el orden");
                    }
                })
                .catch(function () {
                    self.guardando = false;
                    self.enableButton("guardarOrden");
                    Espo.Ui.error("Error de conexión al guardar el orden");
                });
        },

        actionCerrar: function () {
            if (this.huboCambios) {
                this.trigger("actualizado");
                return;
            }

            this.close();
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
