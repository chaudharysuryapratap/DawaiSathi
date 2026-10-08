import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";

export function CareIllustration({ kind }: { kind: "medicine" | "appointment" | "prescription" | "family" }) {
  const palette = { medicine: ["#009D90", "#006A61"], appointment: ["#FFC14D", "#F49721"], prescription: ["#5D9AFF", "#2465ED"], family: ["#9384EB", "#5145BB"] }[kind];
  return <Svg width={86} height={86} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id={kind + "-main"} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={palette[0]} /><Stop offset="1" stopColor={palette[1]} /></LinearGradient>
      <LinearGradient id={kind + "-white"} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFFFFF" /><Stop offset="1" stopColor="#D9EDE9" /></LinearGradient>
    </Defs>
    {kind === "medicine" ? <G>
      <G transform="rotate(42 47 52)">
        <Rect x={31} y={18} width={36} height={74} rx={18} fill="#087B70" opacity={0.12} />
        <Rect x={29} y={14} width={36} height={74} rx={18} fill={`url(#${kind}-main)`} />
        <Path d="M29 51H65V70A18 18 0 0 1 29 70Z" fill={`url(#${kind}-white)`} />
        <Path d="M36 43V33Q36 21 47 20" stroke="#7FE0D1" strokeWidth={4} opacity={0.55} strokeLinecap="round" fill="none" />
      </G>
      <Path d="M82 24L88 15M85 36L95 34" stroke="#009184" strokeWidth={4} strokeLinecap="round" />
    </G> : kind === "appointment" ? <G>
      <Rect x={15} y={25} width={61} height={61} rx={10} fill="#D5AF5A" opacity={0.15} />
      <Rect x={14} y={22} width={61} height={61} rx={10} fill={`url(#${kind}-white)`} />
      <Path d="M14 40V32Q14 22 24 22H65Q75 22 75 32V40Z" fill={`url(#${kind}-main)`} />
      <Path d="M28 16V29M60 16V29" stroke="#8B4E1E" strokeWidth={5} strokeLinecap="round" />
      {[29,44,59].map(x => [51,65].map(y => <Circle key={x+"-"+y} cx={x} cy={y} r={3.5} fill="#80BFB5" />))}
      <Circle cx={69} cy={73} r={17} fill={`url(#${kind}-main)`} /><Circle cx={69} cy={73} r={12} fill="#FFFDF5" />
      <Path d="M69 65V74H76" stroke="#D68B29" strokeWidth={3} strokeLinecap="round" fill="none" />
      <Path d="M87 31L93 23M90 41L97 39" stroke="#FFC258" strokeWidth={4} strokeLinecap="round" />
    </G> : kind === "prescription" ? <G>
      <Path d="M28 16H58L78 36V80Q78 88 70 88H28Q20 88 20 80V24Q20 16 28 16Z" fill="#2865E1" opacity={0.13} />
      <Path d="M28 14H58L78 34V78Q78 86 70 86H28Q20 86 20 78V22Q20 14 28 14Z" fill={`url(#${kind}-main)`} />
      <Path d="M29 20H56V37H72V77Q72 80 69 80H29Q26 80 26 77V23Q26 20 29 20Z" fill="#F5FCFF" />
      <Path d="M58 14V29Q58 34 64 34H78" fill="#2558D4" />
      <Path d="M48 44V61M40 52H56M37 70H61" stroke={`url(#${kind}-main)`} strokeWidth={6} strokeLinecap="round" />
    </G> : <G>
      <Circle cx={38} cy={38} r={12} fill={`url(#${kind}-main)`} /><Circle cx={67} cy={33} r={12} fill={`url(#${kind}-main)`} />
      <Path d="M15 74Q15 52 37 52Q59 52 59 74V77H20Q15 77 15 74Z" fill={`url(#${kind}-main)`} />
      <Path d="M58 51Q68 44 80 52Q90 59 90 70V74H65Q65 59 58 51Z" fill={`url(#${kind}-main)`} />
    </G>}
  </Svg>;
}
