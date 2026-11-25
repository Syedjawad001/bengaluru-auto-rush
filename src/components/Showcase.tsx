import { Badge } from "@/components/ui/8bit/badge";
import { Button } from "@/components/ui/8bit/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/8bit/card";
import { Progress } from "@/components/ui/8bit/progress";

export function Showcase() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#16171d",
        color: "#f3f4f6",
        fontFamily: "'Press Start 2P', system-ui, sans-serif",
        padding: "32px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "48px",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div>
        <h1
          style={{
            fontSize: "20px",
            letterSpacing: "2px",
            color: "#aa3bff",
            margin: "0 0 8px",
          }}
        >
          BENGALURU AUTO RUSH
        </h1>
        <p style={{ fontSize: "9px", color: "#6b6375", margin: 0 }}>
          8bitcn/ui component showcase
        </p>
      </div>

      {/* ── Buttons ─────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>BUTTONS</SectionTitle>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", alignItems: "center" }}>
          <Button variant="default">START GAME</Button>
          <Button variant="secondary">OPTIONS</Button>
          <Button variant="outline">LEADERBOARD</Button>
          <Button variant="ghost">CREDITS</Button>
          <Button variant="destructive">QUIT</Button>
          <Button variant="default" size="sm">SMALL</Button>
          <Button variant="default" size="lg">LARGE</Button>
          <Button variant="default" font="normal">Normal font</Button>
        </div>
      </section>

      {/* ── Badges ──────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>BADGES</SectionTitle>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center" }}>
          <Badge>DEFAULT</Badge>
          <Badge variant="secondary">SECONDARY</Badge>
          <Badge variant="outline">OUTLINE</Badge>
          <Badge variant="destructive">DANGER</Badge>
          <Badge>LVL 12</Badge>
          <Badge variant="secondary">3x COMBO</Badge>
          <Badge variant="destructive">WANTED</Badge>
        </div>
      </section>

      {/* ── Progress / Bars ─────────────────────────────────────────── */}
      <section>
        <SectionTitle>PROGRESS BARS</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "400px" }}>
          <div>
            <Label>HEALTH</Label>
            <Progress value={72} />
          </div>
          <div>
            <Label>TURBO</Label>
            <Progress value={45} />
          </div>
          <div>
            <Label>XP TO NEXT LEVEL</Label>
            <Progress value={90} />
          </div>
          <div>
            <Label>LOADING...</Label>
            <Progress value={33} />
          </div>
        </div>
      </section>

      {/* ── Cards ───────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>CARDS</SectionTitle>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "24px",
          }}
        >
          <Card>
            <CardHeader>
              <CardTitle>AUTO RICKSHAW</CardTitle>
            </CardHeader>
            <CardContent>
              <p style={{ fontSize: "9px", lineHeight: 1.8, margin: 0, color: "#9ca3af" }}>
                Your trusty ride through the chaos of Bengaluru traffic.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="default" size="sm">SELECT</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>HIGH SCORE</CardTitle>
            </CardHeader>
            <CardContent>
              <p
                style={{
                  fontSize: "24px",
                  fontFamily: "'Press Start 2P', sans-serif",
                  color: "#aa3bff",
                  margin: "0 0 8px",
                }}
              >
                48,250
              </p>
              <Badge>PERSONAL BEST</Badge>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm">SHARE</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>DRIVER STATS</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <Label>SPEED</Label>
                  <Progress value={80} />
                </div>
                <div>
                  <Label>HANDLING</Label>
                  <Progress value={60} />
                </div>
                <div>
                  <Label>LUCK</Label>
                  <Progress value={42} />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="ghost" size="sm">UPGRADE</Button>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* Footer note */}
      <p style={{ fontSize: "8px", color: "#6b6375", textAlign: "center" }}>
        PHASE 4 COMPLETE — 8BITCN/UI COMPONENTS VERIFIED
      </p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: "11px",
        color: "#aa3bff",
        marginBottom: "20px",
        letterSpacing: "2px",
        borderBottom: "2px solid #2e303a",
        paddingBottom: "8px",
      }}
    >
      {children}
    </h2>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: "7px",
        color: "#6b6375",
        margin: "0 0 4px",
        letterSpacing: "1px",
      }}
    >
      {children}
    </p>
  );
}
