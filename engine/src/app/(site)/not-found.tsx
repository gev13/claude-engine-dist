import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Heading } from '@/components/ui/Heading';
import { Section } from '@/components/ui/Section';

export default function NotFound() {
  return (
    <Section size="lg" rule={false}>
      <div className="min-h-[46vh]">
        <Eyebrow>Error 404</Eyebrow>
        <Heading level={1} className="max-w-[18ch]">
          That page isn&apos;t here.
        </Heading>
        <p className="mt-5 max-w-[52ch] text-[17px] text-ash">
          The link may be out of date, or the page may have moved. The services index and the knowledge base are the
          two best places to pick the thread back up.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="/" withArrow>
            Back to the homepage
          </Button>
          <Button href="/services" variant="outline">
            All services
          </Button>
        </div>
      </div>
    </Section>
  );
}
