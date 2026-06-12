(function() {
    
    if (typeof Espo !== 'undefined' && Espo.loader) {
        Espo.loader.define('interfaz:controllers/lista-usuarios', 'interfaz:src/controllers/lista-usuarios');
        Espo.loader.define('interfaz:views/lista-usuarios', 'interfaz:src/views/lista-usuarios');
        
        console.log('✅ Módulo Interfaz registrado correctamente');
    }
})();