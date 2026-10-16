import {verifiedBackendEnabled,getVerifiedLeaderboard} from '../services/verified-game-api.js';

// Only real, opted-in, server-verified players. No fabricated fallback entries.
export async function initOfficialLeaderboard(date){
  if(!verifiedBackendEnabled)return;
  const section=document.getElementById('verifiedRanking');
  const select=document.getElementById('verifiedPeriod');
  const rows=document.getElementById('verifiedRankingRows');
  const status=document.getElementById('verifiedRankingStatus');
  if(!section||!select||!rows||!status)return;
  async function load(){
    rows.replaceChildren();
    status.textContent='Pobieram zweryfikowane wyniki…';
    try {
      const result=await getVerifiedLeaderboard(select.value,date,50);
      if(!result.available){section.hidden=true;return;}
      section.hidden=false;
      for(const entry of result.entries||[]){
        const li=document.createElement('li');
        const player=document.createElement('span');
        player.textContent=String(entry.place)+'. '+String(entry.nickname);
        const score=document.createElement('strong');
        score.textContent=Number(entry.points).toLocaleString('pl-PL')+' pkt';
        li.append(player,score);
        rows.append(li);
      }
      status.textContent=result.entries?.length ? 'Ranking odświeżony.' : 'W tym okresie nie ma jeszcze zweryfikowanych wyników.';
    }catch {
      section.hidden=false;
      status.textContent='Ranking jest chwilowo niedostępny. Spróbuj ponownie.';
    }
  }
  select.addEventListener('change',load);
  await load();
}
