define("interfaz:controllers/lista-embajadores", [
    "controllers/base",
], function (Base) {
    return Base.extend({
        checkAccess: function () {
            return true;
        },

        defaultAction: "index",

        actionIndex: function (options) {
            const page = options && options.page ? parseInt(options.page) : 1;
            this.main("interfaz:views/lista-embajadores", {
                paginaInicial: page,
                scope: "CAmbassador"
            });
        },

        actionView: function (options) {
            const id = options && options.id ? options.id : null;
            if (!id) {
                this.getRouter().navigate("#ListaEmbajadores", { trigger: true });
                return;
            }
            this.main("interfaz:views/detalle-embajador", {
                embajadorId: id,
                scope: "CAmbassador"
            });
        }
    });
});