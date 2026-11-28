import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
import { Heading, OpenSection, SectionLabel, useTypeScale } from '@/components/public/ui';
import { accentText } from '@/theme/tokens';
import { useTokens } from '@/theme/v5-theme-provider';

const PUBLIC_ENDPOINTS = [
  {
    title: 'API version and liveness',
    url: 'https://api.flowsmartly.com/health/live',
    description: 'Read the status and version reported by the FlowSmartly API.',
  },
  {
    title: 'Published FlowSmartly News',
    url: 'https://flowsmartly.com/_news/feed.json',
    description: 'Read the latest published newsroom items and their sources as JSON.',
  },
  {
    title: 'News sitemap',
    url: 'https://flowsmartly.com/_news/sitemap.xml',
    description: 'Discover the canonical URLs of published news articles.',
  },
] as const;

export default function ApiDocsPage() {
  const tokens = useTokens();
  const type = useTypeScale();
  const linkColor = accentText(tokens.brand, tokens);

  return (
    <PageShell
      title="FlowSmartly API documentation"
      description="Find the public FlowSmartly API endpoints and learn how authorized workspace integrations are managed."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Resources', path: ROUTES.resources },
          { name: 'API documentation', path: ROUTES.apiDocs },
        ]),
      ]}>
      <OpenSection>
        <View style={{ gap: 12, maxWidth: 780 }}>
          <SectionLabel>DEVELOPERS</SectionLabel>
          <Heading level={1} style={[type.display, { color: tokens.text }]}>
            FlowSmartly API documentation
          </Heading>
          <Text style={[type.body, { color: tokens.textMuted }]}>
            Use these read-only endpoints for public service and news information. Workspace
            operations require authentication and the appropriate permissions.
          </Text>
        </View>
      </OpenSection>

      <OpenSection>
        <View style={{ gap: 24, maxWidth: 780 }}>
          <Heading level={2} style={[type.h2, { color: tokens.text }]}>
            Public endpoints
          </Heading>
          {PUBLIC_ENDPOINTS.map(({ title, url, description }) => (
            <View key={url} style={{ gap: 6, minWidth: 0 }}>
              <Heading level={3} style={[type.h3, { color: tokens.text }]}>
                {title}
              </Heading>
              <Text style={[type.body, { color: tokens.textMuted }]}>{description}</Text>
              <Text selectable style={[type.bodySm, { color: tokens.text }]}>
                GET {url}
              </Text>
              <Link href={url} style={{ color: linkColor }}>
                Open {title.toLowerCase()}
              </Link>
            </View>
          ))}
        </View>
      </OpenSection>

      <OpenSection>
        <View style={{ gap: 12, maxWidth: 780 }}>
          <Heading level={2} style={[type.h2, { color: tokens.text }]}>
            Connecting a workspace
          </Heading>
          <Text style={[type.body, { color: tokens.textMuted }]}>
            Open Connections after signing in to authorize a supported provider. Workspace
            permissions and approvals govern the work that can use the connection.
          </Text>
          <Link href={ROUTES.integrations} style={{ color: linkColor }}>
            View integrations
          </Link>
          <Link href={ROUTES.contact} style={{ color: linkColor }}>
            Ask about API access
          </Link>
        </View>
      </OpenSection>
    </PageShell>
  );
}
