define("interfaz:controllers/lista-copys", [
    "controllers/base",
], function (Base) {
    return Base.extend({
        checkAccess: function () {
            return true;
        },

        defaultAction: "index",

        actionIndex: function (options) {
            this.main("interfaz:views/lista-copys", {});
        }
    });
});
