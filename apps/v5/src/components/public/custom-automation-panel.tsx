import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { BrandLogo } from './brand-logo';
import { useTypeScale, type TypeScale } from './ui';
import { elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/**
 * The product mockup beside the Custom AI Automation hero: a flow that has been
 * built for one business, the systems it reaches into, and what it gave back.
 *
 * **Arrows are inline elements, not a measured connector overlay.** That is
 * deliberate and it is the one case where the connector surface is the wrong
 * tool: the hero wraps this panel in a `Reveal`, which translates, and a
 * translate between the surface and the nodes it measures detaches every wire
 * (`AGENTS.md` rule 9). An arrow that lives *in* the flex flow cannot come
 * apart from the nodes it sits between, at any width.
 *
 * The figure is labelled illustrative. It is a drawing of software, so a sample
 * number is honest — provided the drawing says so, which is the convention
 * `/status` and the footer already follow.
 */

type Node = { icon: string; title: string; sub: string; tone: 'brand' | 'violet' | 'green' };

const ROW_ONE: Node[] = [
  { icon: 'user-plus', title: 'New lead', sub: 'Captured', tone: 'brand' },
  { icon: 'wand-magic-sparkles', title: 'Qualify & enrich', sub: 'Lead', tone: 'violet' },
  { icon: 'file-lines', title: 'Create proposal', sub: 'Automatically', tone: 'brand' },
];

const ROW_TWO: Node[] = [
  { icon: 'bell', title: 'Notify team', sub: 'Instantly', tone: 'green' },
  { icon: 'envelope', title: 'Follow up', sub: '& nurture', tone: 'violet' },
];

/** Real marks, resolved by `BrandLogo`; never drawn by hand. */
const SYSTEMS = ['Salesforce', 'Gmail', 'Slack', 'Google Sheets'];

function FlowNode({ node }: { node: Node }) {
  const t = useTokens();
  const styles = useStyles();
  const color = node.tone === 'violet' ? t.violet : node.tone === 'green' ? t.green : t.brand;

  return (
    <View style={styles.node}>
      <View style={[styles.nodeIcon, { backgroundColor: softFill(color, t) }]}>
        <FontAwesome6 name={node.icon as never} size={14} color={color} />
      </View>
      <Text style={styles.nodeTitle} numberOfLines={2}>
        {node.title}
      </Text>
      <Text style={styles.nodeSub} numberOfLines={1}>
        {node.sub}
      </Text>
    </View>
  );
}

function Arrow() {
  const t = useTokens();
  return (
    <View style={{ flexGrow: 0, flexShrink: 0, paddingHorizontal: 2 }}>
      <FontAwesome6 name="arrow-right" size={11} color={t.textSubtle} />
    </View>
  );
}

function FlowRow({ nodes }: { nodes: Node[] }) {
  const styles = useStyles();
  return (
    <View style={styles.flowRow}>
      {nodes.map((node, index) => (
        <View key={node.title} style={styles.flowItem}>
          {index > 0 ? <Arrow /> : null}
          <FlowNode node={node} />
        </View>
      ))}
    </View>
  );
}

export function CustomAutomationPanel() {
  const t = useTokens();
  const styles = useStyles();

  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle} numberOfLines={1}>
          Your custom automation
        </Text>
        <View style={[styles.livePill, { backgroundColor: softFill(t.green, t) }]}>
          <View style={[styles.liveDot, { backgroundColor: t.green }]} />
          <Text style={[styles.livePillText, { color: t.green }]}>Active</Text>
        </View>
      </View>

      <View style={styles.flow}>
        <FlowRow nodes={ROW_ONE} />
        <FlowRow nodes={ROW_TWO} />
      </View>

      <View style={styles.split}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Time saved this month</Text>
          <View style={styles.metricValueRow}>
            <Text style={styles.metricValue}>128</Text>
            <Text style={styles.metricUnit}>hrs</Text>
          </View>
          <Text style={[styles.metricDelta, { color: t.green }]}>+32% vs last month</Text>
        </View>

        <View style={styles.systems}>
          <Text style={styles.metricLabel}>Connected systems</Text>
          <View style={styles.systemsList}>
            {SYSTEMS.map((system) => (
              <View key={system} style={styles.systemRow}>
                <BrandLogo name={system} size={14} label={system} />
                <Text style={styles.systemName} numberOfLines={1}>
                  {system}
                </Text>
                <FontAwesome6 name="circle-check" size={11} color={t.green} />
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* The convention the rest of the site follows for a sample figure. */}
      <Text style={styles.illustrative}>Illustrative example — not customer data.</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

function useStyles() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  return useMemo(() => createStyles(t, l, type), [t, l, type]);
}

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  const inner: ViewStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 13,
    backgroundColor: t.surfaceRaised,
    padding: 13,
  };

  return StyleSheet.create({
    panel: {
      width: '100%',
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surface,
      padding: l.isPhone ? 14 : 18,
      gap: 14,
      ...(elevation(t, 2) as ViewStyle),
    },

    panelHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    panelTitle: {
      ...type.bodySm,
      color: t.text,
      fontWeight: '800',
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
    },
    livePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      flexGrow: 0,
      flexShrink: 0,
    },
    liveDot: { width: 5, height: 5, borderRadius: 3 },
    livePillText: { ...type.micro, fontWeight: '800' },

    /* flow ---------------------------------------------------------- */
    flow: { ...inner, gap: 10 },
    flowRow: { flexDirection: 'row', alignItems: 'stretch' },
    /** the arrow travels with the node it precedes, so a wrap never strands one */
    flowItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
    },
    node: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      alignItems: 'center',
      gap: 4,
      paddingVertical: 8,
      paddingHorizontal: 4,
      borderRadius: 10,
      backgroundColor: t.surfaceMuted,
    },
    nodeIcon: {
      width: 28,
      height: 28,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      flexGrow: 0,
      flexShrink: 0,
    },
    nodeTitle: { ...type.micro, color: t.text, fontWeight: '800', textAlign: 'center' },
    nodeSub: { ...type.micro, color: t.textSubtle, textAlign: 'center' },

    /* metric + systems ---------------------------------------------- */
    split: { flexDirection: l.isPhone ? 'column' : 'row', gap: 10, alignItems: 'stretch' },
    metric: { ...inner, flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 3 },
    metricLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    metricValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
    metricValue: { ...type.h3, color: t.text },
    metricUnit: { ...type.micro, color: t.textMuted, paddingBottom: 3 },
    metricDelta: { ...type.micro, fontWeight: '700' },

    systems: { ...inner, flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 8 },
    systemsList: { gap: 7 },
    systemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    systemName: {
      ...type.micro,
      color: t.text,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },

    illustrative: { ...type.micro, color: t.textSubtle, textAlign: 'center' },
  });
}
