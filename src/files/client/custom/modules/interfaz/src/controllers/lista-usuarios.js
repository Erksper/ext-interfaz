define("interfaz:controllers/lista-usuarios", [
    "controllers/base",
], function (Base) {
    return Base.extend({
        checkAccess: function () {
            return true;
        },

        defaultAction: "index",

        actionIndex: function (options) {
            console.log("🎯 actionIndex - Cargando lista de usuarios");
            
            const page = options && options.page ? parseInt(options.page) : 1;
            
            const viewParams = {
                paginaInicial: page,
                scope: "User",
                previousRoute: null,
            };

            this.main("interfaz:views/lista-usuarios", viewParams);
        },
    });
});