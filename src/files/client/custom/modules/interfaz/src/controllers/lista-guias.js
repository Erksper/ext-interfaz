define("interfaz:controllers/lista-guias", [
    "controllers/base",
], function (Base) {
    return Base.extend({
        checkAccess: function () {
            return true;
        },

        defaultAction: "index",

        actionIndex: function (options) {
            this.main("interfaz:views/lista-guias", {});
        }
    });
});
