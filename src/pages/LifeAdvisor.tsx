import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { PageHeading } from "../components/ui";
import { LifeChat } from "../components/LifeChat";
export default function LifeAdvisor() {
  return (
    <>
      <PageHeading
        eyebrow="KAYNAKLI DANIŞMAN"
        title="Sorunu birlikte açalım."
        description="İSUBÜ öğrenci rehberleri ve GSB barınma kaynaklarından yararlan. Önceki konuşmana devam edebilir, kaynakları tek tek inceleyebilirsin."
        action={
          <Link className="button light" to="/kampus">
            Yaşam rehberi <ArrowUpRight size={16} />
          </Link>
        }
      />
      <section className="panel standalone-chat">
        <LifeChat />
      </section>
    </>
  );
}
