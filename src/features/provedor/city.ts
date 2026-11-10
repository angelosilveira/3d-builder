export interface UrbanArea {
  kind:'district'|'street'
  id:string
  districtId:string
  name:string
  x:number
  z:number
}

// Endereços fictícios do cenário de Aracatu. Cada rua atende os dois lados da via.
const blocks=[
  ['Centro','Rua do Mercado','Rua da Matriz','Rua da Feira','Rua do Comércio','Rua do Correio','Rua do Paço','Rua das Oficinas','Rua da Estação'],
  ['Boa Vista','Rua do Horizonte','Rua do Mirante','Rua da Colina','Rua da Ladeira','Rua das Pedras','Rua do Sol','Rua do Cruzeiro','Rua do Alto'],
  ['Vila Nova','Rua da Vila','Rua da Escola','Rua do Campo','Rua da Ponte','Rua da Fonte','Rua do Largo','Rua da Capela','Rua do Encontro'],
  ['São José','Rua São José','Rua das Palmeiras','Rua dos Lírios','Rua das Acácias','Rua do Jardim','Rua dos Ipês','Rua da Mangueira','Rua dos Cedros'],
  ['Primavera','Rua das Rosas','Rua das Orquídeas','Rua das Violetas','Rua das Flores','Rua do Parque','Rua da Nascente','Rua do Bosque','Rua da Alvorada'],
  ['Bela União','Rua da União','Rua da Amizade','Rua do Povo','Rua da Vitória','Rua da Paz','Rua da Bandeira','Rua da Liberdade','Rua da Alegria'],
]
export const districts:UrbanArea[]=blocks.map(([name],i)=>({
  kind:'district',id:'bairro-'+i,districtId:'bairro-'+i,name,x:(i%3-1)*17,z:i<3?-11:11,
}))
export const cityStreets:UrbanArea[]=districts.flatMap((d,i)=>blocks[i].slice(1).map((name,j)=>({
  kind:'street',id:d.id+'-rua-'+j,districtId:d.id,name,x:d.x,z:d.z+(j-3.5)*1.82,
})))
export const urbanAreas=new Map([...districts,...cityStreets].map(a=>[a.id,a]))
export const homesPerStreet=32
export const citySize=cityStreets.length*homesPerStreet
export function urbanAddress(index:number){
  // Os primeiros 32 contratos já existiam em duas ruas antes da expansão.
  const slot=index>=16&&index<32?index+16:index>=32&&index<48?index-16:index
  const streetIndex=Math.floor(slot/homesPerStreet),street=cityStreets[streetIndex]
  const residence=slot%homesPerStreet
  const number=index<32?24+11*index:401+residence
  return {street,number,pointIndex:Math.floor(streetIndex/8)*2+streetIndex%2,
    x:street.x+(Math.floor(residence/2)-7.5)*.91,z:street.z+(residence%2===0?-.46:.46)}
}
