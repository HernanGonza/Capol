import LegalPageLayout from "@/components/LegalPageLayout";

const Privacidad = () => {
  return (
    <LegalPageLayout title="Política de Privacidad" actualizado="2 de agosto de 2026">
      <section>
        <h2>1. Qué datos recopilamos</h2>
        <p>Cuando creás una cuenta y usás CapOL, recopilamos:</p>
        <ul>
          <li><strong>Datos de registro:</strong> nombre completo, email, contraseña, teléfono, DNI, dirección, localidad, provincia y país.</li>
          <li><strong>Datos opcionales:</strong> foto de perfil.</li>
          <li><strong>Datos de uso:</strong> cursos en los que te inscribís, progreso en las lecciones, mensajes que enviás en foros o mensajería directa, y actividad general dentro de la Plataforma.</li>
          <li><strong>Datos de pago:</strong> registro de las suscripciones e inscripciones que gestionamos manualmente (no procesamos ni almacenamos números de tarjeta — el pago se coordina por fuera de la Plataforma según el medio que elijas).</li>
        </ul>
      </section>

      <section>
        <h2>2. Para qué usamos tus datos</h2>
        <ul>
          <li>Crear y administrar tu cuenta, y darte acceso a los cursos en los que te inscribís.</li>
          <li>Gestionar solicitudes de inscripción y suscripciones.</li>
          <li>Comunicarnos con vos (confirmaciones, avisos de clases, novedades relevantes de tus cursos).</li>
          <li>Emitir certificados de finalización a tu nombre.</li>
          <li>Mantener la seguridad de la Plataforma (por ejemplo, para investigar reportes de mal uso en foros o mensajería).</li>
          <li>Mostrarte, si sos administrador o profesor, la información necesaria para gestionar alumnos y cursos.</li>
        </ul>
        <p>No usamos tus datos personales con fines de publicidad de terceros ni los vendemos.</p>
      </section>

      <section>
        <h2>3. Con quién se comparten tus datos</h2>
        <p>
          Tus datos se almacenan en la infraestructura de <strong>Supabase</strong>, nuestro proveedor de base
          de datos, autenticación y almacenamiento de archivos, que puede procesar y alojar la información en
          servidores fuera de Argentina. Solo compartimos datos con este proveedor en la medida necesaria para
          operar la Plataforma — no los cedemos a otros terceros, salvo que la ley nos obligue a hacerlo.
        </p>
        <p>
          Dentro de la Plataforma, otros usuarios pueden ver tu nombre y foto de perfil en foros, mensajería y
          listados de curso, según tu rol. Los administradores y, en su curso, los profesores asignados, pueden
          ver tus datos de contacto e inscripción para gestionar el curso.
        </p>
      </section>

      <section>
        <h2>4. Cookies y almacenamiento local</h2>
        <p>
          Usamos cookies y almacenamiento local del navegador únicamente con fines funcionales: mantener tu
          sesión iniciada y recordar tu preferencia de tema claro/oscuro. No usamos cookies de publicidad ni de
          rastreo de terceros.
        </p>
      </section>

      <section>
        <h2>5. Seguridad</h2>
        <p>
          Tu contraseña se almacena encriptada (nunca en texto plano). El acceso a los datos dentro de la base
          está restringido por reglas de seguridad a nivel de fila (Row Level Security), de forma que cada
          usuario solo puede ver la información que le corresponde según su rol. Aun así, ningún sistema es
          100% infalible — si detectás algo irregular en tu cuenta, avisanos de inmediato.
        </p>
      </section>

      <section>
        <h2>6. Tus derechos</h2>
        <p>
          De acuerdo con la Ley 25.326 de Protección de Datos Personales de Argentina, tenés derecho a acceder,
          rectificar y suprimir tus datos personales. Podés hacerlo vos mismo desde "Mi Perfil" dentro de la
          Plataforma, o escribiéndonos a{" "}
          <a href="mailto:capolescuela@gmail.com">capolescuela@gmail.com</a>. También tenés derecho a presentar
          una queja ante la Agencia de Acceso a la Información Pública, el organismo de control en la materia.
        </p>
      </section>

      <section>
        <h2>7. Menores de edad</h2>
        <p>
          La Plataforma está dirigida a mayores de 18 años. Si sos menor de edad, tu registro y uso del
          Servicio deben contar con el consentimiento y la supervisión de un padre, madre o tutor legal.
        </p>
      </section>

      <section>
        <h2>8. Retención de datos</h2>
        <p>
          Conservamos tus datos mientras tu cuenta esté activa. Si solicitás la baja de tu cuenta, conservamos
          cierta información (como el historial de pagos) por el tiempo que exijan las obligaciones legales o
          contables aplicables, y eliminamos o anonimizamos el resto.
        </p>
      </section>

      <section>
        <h2>9. Cambios a esta política</h2>
        <p>
          Podemos actualizar esta Política de Privacidad. Si el cambio es significativo, te lo vamos a
          comunicar a través de la Plataforma o por email.
        </p>
      </section>

      <section>
        <h2>10. Contacto</h2>
        <p>
          Ante cualquier consulta sobre el tratamiento de tus datos personales, escribinos a{" "}
          <a href="mailto:capolescuela@gmail.com">capolescuela@gmail.com</a>.
        </p>
      </section>
    </LegalPageLayout>
  );
};

export default Privacidad;
