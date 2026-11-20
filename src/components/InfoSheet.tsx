import { fmt, WIDMARK_R } from "../lib/drinks.ts";
import { useProfile } from "../profile.ts";
import { Sheet } from "./Sheet.tsx";

export function InfoSheet({ open, onClose, onProfile }: { open: boolean; onClose: () => void; onProfile: () => void }) {
  const profile = useProfile();
  const r = String(WIDMARK_R[profile.sex]).replace(".", ",");
  return (
    <Sheet open={open} onClose={onClose} label="Hoe werkt het?">
      <div className="sheet-body info">
        <h2 className="sheet-title">Hoe werkt het?</h2>
        <ol className="info-steps">
          <li>Je fotografeert de drankkaart, zoveel foto's als nodig.</li>
          <li>Een AI leest per drank de prijs, het volume en het alcoholpercentage. Staat iets niet op de kaart, dan schat ze het (aangeduid met ≈).</li>
          <li>Wij rekenen uit hoeveel promille elk drankje jou oplevert en wat één promille kost.</li>
        </ol>

        <div className="formula">
          <div>
            <span className="formula-k">gram alcohol</span> = volume (ml) × alcohol% ÷ 100 × 0,789
          </div>
          <div>
            <span className="formula-k">promille</span> = gram alcohol ÷ (gewicht × r)
          </div>
          <div>
            <span className="formula-k">prijs per promille</span> = prijs ÷ promille
          </div>
          <p>
            Formule van Widmark, met r = 0,7 voor mannen en 0,6 voor vrouwen. Nu voor{" "}
            <button className="link-btn" onClick={onProfile}>
              {profile.sex}, {fmt.kg(profile.weightKg)}
            </button>{" "}
            (r = {r}). Het is de geschatte piek als je het glas in één keer drinkt; je lichaam breekt ongeveer 0,1 à
            0,15‰ per uur af, en eten en tempo spelen ook mee.
          </p>
        </div>

        <p className="info-small">
          Tik op een drank om prijs, volume of percentage aan te passen. De ranking schuift meteen mee.
        </p>

        <div className="info-warning">
          <strong>Alcohol schaadt de gezondheid.</strong> Drink met mate, wissel af met water en wie drinkt, rijdt
          niet. Deze ranking is een prijsvergelijking, geen uitnodiging om meer te drinken. De promille zijn een ruwe
          schatting: gebruik ze nooit om te beslissen of je nog mag rijden.
          <br />
          Vragen over alcohol? De DrugLijn:{" "}
          <a href="tel:078151020">078 15 10 20</a> ·{" "}
          <a href="https://www.druglijn.be" target="_blank" rel="noreferrer">
            druglijn.be
          </a>
        </div>

        <p className="info-small">
          Privacy: je foto's gaan enkel naar OpenAI om de kaart te lezen en worden door ons niet opgeslagen. Je
          ranking blijft op je eigen toestel.
        </p>
        <p className="info-credit">
          PPP · gemaakt door{" "}
          <a href="https://larsschrijvers.be" target="_blank" rel="noreferrer">
            Lars Schrijvers
          </a>
        </p>
        <button className="btn btn-primary btn-block" onClick={onClose}>
          Begrepen
        </button>
      </div>
    </Sheet>
  );
}
