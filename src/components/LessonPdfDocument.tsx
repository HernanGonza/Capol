import { Document, Page, Text, View, Image, StyleSheet, Link } from "@react-pdf/renderer";
import { marked } from "marked";
import type { ReactNode } from "react";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", color: "#1e293b" },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  description: { fontSize: 12, color: "#64748b", marginBottom: 14 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#e2e8f0", marginBottom: 14 },
  paragraph: { fontSize: 11, marginBottom: 8, lineHeight: 1.5 },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 6 },
  h2: { fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 6 },
  h3: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 5 },
  h4: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 4 },
  listRow: { flexDirection: "row", marginBottom: 3 },
  listBullet: { width: 14, fontSize: 11 },
  listText: { flex: 1, fontSize: 11, lineHeight: 1.4 },
  code: { fontFamily: "Courier", fontSize: 9, backgroundColor: "#0f172a", color: "#e2e8f0", padding: 10, borderRadius: 4, marginBottom: 10 },
  blockquote: { borderLeftWidth: 2, borderLeftColor: "#94a3b8", paddingLeft: 10, marginBottom: 8 },
  block: { marginBottom: 14 },
  image: { maxWidth: "100%", marginBottom: 10, borderRadius: 4 },
  noteBox: { backgroundColor: "#f8fafc", padding: 10, borderRadius: 6, marginBottom: 4 },
  noteLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  noteLink: { fontSize: 9, color: "#4f46e5" },
  calloutBox: { padding: 12, borderRadius: 6, borderLeftWidth: 3 },
  calloutText: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  quizCard: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 12, marginBottom: 8 },
  quizQuestion: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  quizOption: { fontSize: 10, marginBottom: 3 },
  checklistRow: { flexDirection: "row", marginBottom: 4 },
  checklistBox: { width: 10, height: 10, borderWidth: 1, borderColor: "#94a3b8", marginRight: 8, marginTop: 1 },
  checklistText: { fontSize: 11, flex: 1 },
  diffCol: { flex: 1, padding: 8, borderRadius: 4 },
  diffLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  diffCode: { fontFamily: "Courier", fontSize: 8 },
});

// --- Markdown -> nodos de @react-pdf/renderer, preservando negrita/cursiva/links ---

const renderInline = (tokens: any[]): ReactNode[] =>
  (tokens || []).map((t, i) => {
    switch (t.type) {
      case "strong":
        return <Text key={i} style={{ fontFamily: "Helvetica-Bold" }}>{renderInline(t.tokens)}</Text>;
      case "em":
        return <Text key={i} style={{ fontFamily: "Helvetica-Oblique" }}>{renderInline(t.tokens)}</Text>;
      case "codespan":
        return <Text key={i} style={{ fontFamily: "Courier", fontSize: 9.5 }}>{t.text}</Text>;
      case "link":
        return <Link key={i} src={t.href} style={{ color: "#4f46e5" }}>{renderInline(t.tokens)}</Link>;
      case "br":
        return "\n";
      default:
        return t.text ?? t.raw ?? "";
    }
  });

const inlineOf = (text: string): ReactNode[] => renderInline(marked.Lexer.lexInline(text || ""));

const renderMarkdownBlocks = (md: string): ReactNode[] => {
  const tokens = marked.lexer(md || "");
  return tokens.map((token: any, i: number) => {
    switch (token.type) {
      case "heading": {
        const style = (styles as any)[`h${Math.min(token.depth, 4)}`] || styles.h4;
        return <Text key={i} style={style}>{renderInline(token.tokens)}</Text>;
      }
      case "paragraph":
        return <Text key={i} style={styles.paragraph}>{renderInline(token.tokens)}</Text>;
      case "list":
        return (
          <View key={i} style={{ marginBottom: 8 }}>
            {token.items.map((item: any, j: number) => (
              <View key={j} style={styles.listRow}>
                <Text style={styles.listBullet}>{token.ordered ? `${j + 1}.` : "•"}</Text>
                <Text style={styles.listText}>{inlineOf(item.text)}</Text>
              </View>
            ))}
          </View>
        );
      case "code":
        return (
          <View key={i} style={styles.code}>
            <Text>{token.text}</Text>
          </View>
        );
      case "blockquote":
        return (
          <View key={i} style={styles.blockquote}>
            {renderMarkdownBlocks(token.text)}
          </View>
        );
      case "space":
        return null;
      default:
        return token.text ? <Text key={i} style={styles.paragraph}>{inlineOf(token.text)}</Text> : null;
    }
  });
};

interface Props {
  lessonTitle: string;
  lessonDescription?: string | null;
  content: string | null;
}

const LessonPdfDocument = ({ lessonTitle, lessonDescription, content }: Props) => {
  const blocks = (() => {
    try { return JSON.parse(content || "[]"); } catch { return []; }
  })();

  const getQuizQuestions = (block: any) => {
    if (Array.isArray(block.preguntas)) return block.preguntas;
    if (block.value) return [{ pregunta: block.value, opciones: [block.a, block.b], correcta: block.correct === "B" ? 1 : 0 }];
    return [];
  };

  const getChecklistItems = (block: any): string[] => {
    if (Array.isArray(block.items)) return block.items.filter((t: string) => t.trim());
    if (typeof block.value === "string") return block.value.split("\n").filter((t: string) => t.trim());
    return [];
  };

  const calloutColors: Record<string, { bg: string; border: string; text: string }> = {
    warning: { bg: "#fffbeb", border: "#f59e0b", text: "#92400e" },
    tip: { bg: "#ecfdf5", border: "#10b981", text: "#065f46" },
    info: { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af" },
  };

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.title}>{lessonTitle}</Text>
        {lessonDescription ? <Text style={styles.description}>{lessonDescription}</Text> : null}
        <View style={styles.divider} />

        {blocks.map((block: any) => {
          switch (block.type) {
            case "text":
              return <View key={block.id} style={styles.block}>{renderMarkdownBlocks(block.value)}</View>;

            case "video":
              return (
                <View key={block.id} style={[styles.noteBox, styles.block]} wrap={false}>
                  <Text style={styles.noteLabel}>🎥 Video</Text>
                  <Link src={block.value} style={styles.noteLink}>{block.value}</Link>
                </View>
              );

            case "image":
              return block.value ? (
                <Image key={block.id} src={block.value} style={[styles.image, styles.block]} />
              ) : null;

            case "terminal":
              return (
                <View key={block.id} style={[styles.noteBox, styles.block]} wrap={false}>
                  <Text style={{ fontSize: 10, color: "#64748b" }}>💻 Consola interactiva — disponible en la plataforma</Text>
                </View>
              );

            case "callout": {
              const c = calloutColors[block.style] || calloutColors.info;
              return (
                <View key={block.id} style={[styles.calloutBox, styles.block, { backgroundColor: c.bg, borderLeftColor: c.border }]} wrap={false}>
                  <Text style={[styles.calloutText, { color: c.text }]}>{block.value}</Text>
                </View>
              );
            }

            case "download":
              return (
                <View key={block.id} style={[styles.noteBox, styles.block]} wrap={false}>
                  <Text style={styles.noteLabel}>📎 Material de apoyo</Text>
                  <Link src={block.value} style={styles.noteLink}>{block.value}</Link>
                </View>
              );

            case "quiz":
              return (
                <View key={block.id} style={styles.block}>
                  {getQuizQuestions(block).map((p: any, qi: number, arr: any[]) => (
                    <View key={qi} style={styles.quizCard} wrap={false}>
                      <Text style={styles.quizQuestion}>{arr.length > 1 ? `${qi + 1}. ` : ""}{p.pregunta}</Text>
                      {p.opciones.map((op: string, oi: number) => (
                        <Text key={oi} style={[styles.quizOption, oi === p.correcta && { color: "#059669", fontFamily: "Helvetica-Bold" }]}>
                          {String.fromCharCode(65 + oi)}) {op}{oi === p.correcta ? "  ✓ Correcta" : ""}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              );

            case "snippet":
              return (
                <View key={block.id} style={[styles.code, styles.block]} wrap={false}>
                  <Text>{block.value}</Text>
                </View>
              );

            case "checklist":
              return (
                <View key={block.id} style={styles.block}>
                  {getChecklistItems(block).map((item: string, ii: number) => (
                    <View key={ii} style={styles.checklistRow}>
                      <View style={styles.checklistBox} />
                      <Text style={styles.checklistText}>{item}</Text>
                    </View>
                  ))}
                </View>
              );

            case "diff":
              return (
                <View key={block.id} style={[{ flexDirection: "row", gap: 8 }, styles.block]} wrap={false}>
                  <View style={[styles.diffCol, { backgroundColor: "#fef2f2" }]}>
                    <Text style={styles.diffLabel}>ANTES</Text>
                    <Text style={styles.diffCode}>{block.oldValue}</Text>
                  </View>
                  <View style={[styles.diffCol, { backgroundColor: "#ecfdf5" }]}>
                    <Text style={styles.diffLabel}>DESPUÉS</Text>
                    <Text style={styles.diffCode}>{block.newValue}</Text>
                  </View>
                </View>
              );

            default:
              return null;
          }
        })}
      </Page>
    </Document>
  );
};

export default LessonPdfDocument;