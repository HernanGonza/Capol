import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

// Logo alojado en Supabase Storage (bucket público "branding") para que el PDF
// lo pueda cargar sin depender del dominio donde esté deployeado el sitio.
const LOGO_URL = "https://jpzicnrimbsqxjezehdf.supabase.co/storage/v1/object/public/branding/logo-capol.png";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", backgroundColor: "#ffffff" },
  outerBorder: { position: "absolute", top: 24, left: 24, right: 24, bottom: 24, borderWidth: 2.5, borderColor: "#6366f1", borderRadius: 6 },
  innerBorder: { position: "absolute", top: 32, left: 32, right: 32, bottom: 32, borderWidth: 1, borderColor: "#c7d2fe", borderRadius: 4 },
  // "body" reemplaza al viejo esquema de content centrado + firmas/footer
  // superpuestos con position:absolute a una distancia fija del borde: con
  // textos largos (curso con título de 2 líneas, etc.) esa distancia fija
  // no alcanzaba y las firmas terminaban tapando el texto. Ahora todo fluye
  // en una sola columna flex, así que las firmas y el footer siempre quedan
  // debajo del contenido, nunca superpuestos, sin importar cuánto ocupe.
  body: { flex: 1, flexDirection: "column", paddingTop: 50, paddingBottom: 45 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 70 },
  logo: { width: 88, height: 88, borderRadius: 44, marginBottom: 18 },
  eyebrow: { fontSize: 12, letterSpacing: 4, color: "#6366f1", fontFamily: "Helvetica-Bold", marginBottom: 18 },
  title: { fontSize: 30, fontFamily: "Helvetica-Bold", color: "#1e1b3a", marginBottom: 26, textAlign: "center" },
  paragraph: { fontSize: 13, color: "#475569", marginBottom: 4, textAlign: "center" },
  studentName: { fontSize: 26, fontFamily: "Helvetica-Bold", color: "#1e1b3a", marginTop: 4, marginBottom: 4, textAlign: "center" },
  courseTitle: { fontSize: 19, fontFamily: "Helvetica-Bold", color: "#6366f1", marginTop: 16, textAlign: "center" },
  footer: { flexDirection: "row", justifyContent: "space-between", width: "100%", paddingHorizontal: 60 },
  footerLabel: { fontSize: 8.5, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 },
  footerValue: { fontSize: 11, color: "#1e1b3a", fontFamily: "Helvetica-Bold", marginTop: 2 },
  signatures: { flexDirection: "row", justifyContent: "space-around", width: "100%", paddingHorizontal: 90, marginBottom: 24 },
  signatureBlock: { alignItems: "center", width: 180 },
  signatureImg: { height: 40, marginBottom: 4, objectFit: "contain" },
  signatureSpacer: { height: 44 },
  signatureLine: { width: 160, borderTopWidth: 1, borderTopColor: "#94a3b8", marginBottom: 4 },
  signatureLabel: { fontSize: 9, color: "#475569", fontFamily: "Helvetica-Bold" },
  signatureSubLabel: { fontSize: 7.5, color: "#94a3b8", textTransform: "uppercase" },
});

interface Props {
  studentName: string;
  courseTitle: string;
  completionDate: string;
  cargaHoraria?: number | null;
  teacherName?: string | null;
  teacherSignatureUrl?: string | null;
  directorSignatureUrl?: string | null;
}

const CertificatePdfDocument = ({
  studentName,
  courseTitle,
  completionDate,
  cargaHoraria,
  teacherName,
  teacherSignatureUrl,
  directorSignatureUrl,
}: Props) => (
  <Document>
    <Page size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.outerBorder} />
      <View style={styles.innerBorder} />
      <View style={styles.body}>
        <View style={styles.content}>
          <Image src={LOGO_URL} style={styles.logo} />
          <Text style={styles.eyebrow}>CAPOL ESCUELA VIRTUAL</Text>
          <Text style={styles.title}>Certificado de Finalización</Text>
          <Text style={styles.paragraph}>Se certifica que</Text>
          <Text style={styles.studentName}>{studentName}</Text>
          <Text style={styles.paragraph}>
            {cargaHoraria ? `completó satisfactoriamente ${cargaHoraria} horas del curso` : "completó satisfactoriamente el curso"}
          </Text>
          <Text style={styles.courseTitle}>{courseTitle}</Text>
        </View>
        {(teacherSignatureUrl || directorSignatureUrl) && (
          <View style={styles.signatures}>
            <View style={styles.signatureBlock}>
              {teacherSignatureUrl ? <Image src={teacherSignatureUrl} style={styles.signatureImg} /> : <View style={styles.signatureSpacer} />}
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>{teacherName || "Profesor"}</Text>
              <Text style={styles.signatureSubLabel}>Profesor</Text>
            </View>
            <View style={styles.signatureBlock}>
              {directorSignatureUrl ? <Image src={directorSignatureUrl} style={styles.signatureImg} /> : <View style={styles.signatureSpacer} />}
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Dirección</Text>
              <Text style={styles.signatureSubLabel}>CapOL Escuela Virtual</Text>
            </View>
          </View>
        )}
        <View style={styles.footer}>
          <View>
            <Text style={styles.footerLabel}>Fecha de finalización</Text>
            <Text style={styles.footerValue}>{completionDate}</Text>
          </View>
          <View>
            <Text style={styles.footerLabel}>Emitido por</Text>
            <Text style={styles.footerValue}>CapOL Escuela Virtual</Text>
          </View>
        </View>
      </View>
    </Page>
  </Document>
);

export default CertificatePdfDocument;
