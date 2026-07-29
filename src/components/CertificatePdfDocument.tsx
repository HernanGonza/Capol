import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

// Logo alojado en Supabase Storage (bucket público "branding") para que el PDF
// lo pueda cargar sin depender del dominio donde esté deployeado el sitio.
const LOGO_URL = "https://jpzicnrimbsqxjezehdf.supabase.co/storage/v1/object/public/branding/logo-capol.png";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", backgroundColor: "#ffffff" },
  outerBorder: { position: "absolute", top: 24, left: 24, right: 24, bottom: 24, borderWidth: 2.5, borderColor: "#6366f1", borderRadius: 6 },
  innerBorder: { position: "absolute", top: 32, left: 32, right: 32, bottom: 32, borderWidth: 1, borderColor: "#c7d2fe", borderRadius: 4 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 70 },
  logo: { width: 56, height: 56, borderRadius: 28, marginBottom: 18 },
  eyebrow: { fontSize: 12, letterSpacing: 4, color: "#6366f1", fontFamily: "Helvetica-Bold", marginBottom: 18 },
  title: { fontSize: 30, fontFamily: "Helvetica-Bold", color: "#1e1b3a", marginBottom: 26, textAlign: "center" },
  paragraph: { fontSize: 13, color: "#475569", marginBottom: 4, textAlign: "center" },
  studentName: { fontSize: 26, fontFamily: "Helvetica-Bold", color: "#1e1b3a", marginTop: 4, marginBottom: 4, textAlign: "center" },
  courseTitle: { fontSize: 19, fontFamily: "Helvetica-Bold", color: "#6366f1", marginTop: 16, marginBottom: 34, textAlign: "center" },
  footer: { flexDirection: "row", justifyContent: "space-between", width: "100%", position: "absolute", bottom: 60, paddingHorizontal: 60 },
  footerLabel: { fontSize: 8.5, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 },
  footerValue: { fontSize: 11, color: "#1e1b3a", fontFamily: "Helvetica-Bold", marginTop: 2 },
});

interface Props {
  studentName: string;
  courseTitle: string;
  completionDate: string;
}

const CertificatePdfDocument = ({ studentName, courseTitle, completionDate }: Props) => (
  <Document>
    <Page size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.outerBorder} />
      <View style={styles.innerBorder} />
      <View style={styles.content}>
        <Image src={LOGO_URL} style={styles.logo} />
        <Text style={styles.eyebrow}>CAPOL ESCUELA VIRTUAL</Text>
        <Text style={styles.title}>Certificado de Finalización</Text>
        <Text style={styles.paragraph}>Se certifica que</Text>
        <Text style={styles.studentName}>{studentName}</Text>
        <Text style={styles.paragraph}>completó satisfactoriamente el curso</Text>
        <Text style={styles.courseTitle}>{courseTitle}</Text>
      </View>
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
    </Page>
  </Document>
);

export default CertificatePdfDocument;
