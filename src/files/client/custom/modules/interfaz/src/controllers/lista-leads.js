define("interfaz:controllers/lista-leads", [
    "controllers/base",
], function (Base) {
    return Base.extend({
        checkAccess: function () {
            return true;
        },

        defaultAction: "index",

        actionIndex: function (options) {
            const page = options && options.page ? parseInt(options.page) : 1;
            this.main("interfaz:views/lista-leads", {
                paginaInicial: page,
                scope: "Opportunity"
            });
        },

        actionView: function (options) {
            const id = options && options.id ? options.id : null;
            if (!id) {
                this.getRouter().navigate("#ListaLeads", { trigger: true });
                return;
            }
            this.main("interfaz:views/detalle-lead", {
                leadId: id,
                scope: "Opportunity"
            });
        }
    });
});