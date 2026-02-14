import { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { sanitizeHtml, extractBodyContent } from "@/lib/landing-pages/sanitizer";

function injectFormScript(pageId: string, body: string): string {
  const script = `<script>
(function() {
  var forms = document.querySelectorAll('form');
  forms.forEach(function(form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"], input[type="submit"], button:last-of-type');
      if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

      var data = {};
      var inputs = form.querySelectorAll('input, textarea, select');
      inputs.forEach(function(input) {
        if (input.name && input.type !== 'submit') {
          data[input.name] = input.value;
        }
      });

      // Capture UTM params
      var urlParams = new URLSearchParams(window.location.search);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function(p) {
        var v = urlParams.get(p);
        if (v) data[p] = v;
      });

      fetch('/api/landing-pages/${pageId}/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      .then(function(res) { return res.json(); })
      .then(function(result) {
        if (result.success) {
          form.innerHTML = '<div style="text-align:center;padding:2rem;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:12px;border:1px solid #bbf7d0"><div style="font-size:2.5rem;margin-bottom:0.5rem">\\u2713</div><h3 style="margin:0 0 0.5rem;color:#166534;font-size:1.25rem">Thank You!</h3><p style="margin:0;color:#15803d;font-size:0.95rem">Your submission has been received. We\\u2019ll be in touch soon!</p></div>';
        } else {
          var err = form.querySelector('.form-error');
          if (!err) { err = document.createElement('p'); err.className = 'form-error'; err.style.cssText = 'color:#dc2626;font-size:0.875rem;margin-top:0.5rem;text-align:center'; form.appendChild(err); }
          err.textContent = result.error || 'Something went wrong. Please try again.';
          if (btn) { btn.disabled = false; btn.textContent = 'Submit'; }
        }
      })
      .catch(function() {
        var err = form.querySelector('.form-error');
        if (!err) { err = document.createElement('p'); err.className = 'form-error'; err.style.cssText = 'color:#dc2626;font-size:0.875rem;margin-top:0.5rem;text-align:center'; form.appendChild(err); }
        err.textContent = 'Network error. Please try again.';
        if (btn) { btn.disabled = false; btn.textContent = 'Submit'; }
      });
    });
  });
})();
</script>`;

  return body + script;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const page = await prisma.landingPage.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { title: true, description: true, settings: true, pageType: true },
  });

  if (!page) {
    return { title: "Page Not Found" };
  }

  const settings = JSON.parse(page.settings || "{}");
  const canonicalUrl = `${process.env.NEXT_PUBLIC_APP_URL || ""}/p/${slug}`;
  const ogImage = settings.imageUrl || settings.logoUrl || undefined;
  const siteName = settings.brandName || "FlowSmartly";

  return {
    title: page.title,
    description: page.description || undefined,
    robots: { index: true, follow: true },
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: page.title,
      description: page.description || undefined,
      type: "website",
      url: canonicalUrl,
      siteName,
      ...(ogImage && { images: [{ url: ogImage, alt: page.title }] }),
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: page.title,
      description: page.description || undefined,
      ...(ogImage && { images: [ogImage] }),
    },
    other: {
      "page-type": page.pageType,
    },
  };
}

export default async function PublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const page = await prisma.landingPage.findFirst({
    where: { slug, status: "PUBLISHED" },
  });

  if (!page) {
    notFound();
  }

  // Increment views fire-and-forget
  prisma.landingPage
    .update({
      where: { id: page.id },
      data: { views: { increment: 1 } },
    })
    .catch(() => {});

  const sanitized = sanitizeHtml(page.htmlContent);
  const { styles, body } = extractBodyContent(sanitized);
  const bodyWithScript = injectFormScript(page.id, body);

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: styles }} />
      <div
        dangerouslySetInnerHTML={{ __html: bodyWithScript }}
        style={{ all: "initial", display: "block" }}
      />
    </>
  );
}
