import React from "react";

const ComprasPageSimple = () => {
  return (
    <div style={{ padding: "20px", backgroundColor: "#f0f0f0" }}>
      <h1 style={{ color: "blue" }}>Compras - Componente Simple</h1>
      <p>Este es un componente completamente simple sin hooks ni contextos.</p>
      <p>Si ves este mensaje, significa que React está funcionando.</p>
      <button onClick={() => alert("¡Botón funciona!")}>
        Probar JavaScript
      </button>
    </div>
  );
};

export default ComprasPageSimple;