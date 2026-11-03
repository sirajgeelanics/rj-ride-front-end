/** Places the form can suggest instantly (no network): airports known to the platform, and hotels. */

export interface LocalPlace {
  /** Stable key. */
  id: string;
  kind: "airport" | "hotel";
  /** First line of the suggestion. */
  label: string;
  /** Muted second line. */
  detail?: string;
  /** Text placed into the address box when picked. */
  address: string;
  /** Extra words that should find it (codes, city, aliases). */
  keywords?: string;
  /** RICH's stable hotel reference (e.g. "HT00110"), sent with the stop for hotels. */
  hotelMappingId?: string;
}

const AIRPORTS: [code: string, name: string, city: string][] = [
  ["DEL", "Indira Gandhi International Airport", "New Delhi"],
  ["BOM", "Chhatrapati Shivaji Maharaj International Airport", "Mumbai"],
  ["BLR", "Kempegowda International Airport", "Bengaluru"],
  ["MAA", "Chennai International Airport", "Chennai"],
  ["CCU", "Netaji Subhas Chandra Bose International Airport", "Kolkata"],
  ["HYD", "Rajiv Gandhi International Airport", "Hyderabad"],
  ["AMD", "Sardar Vallabhbhai Patel International Airport", "Ahmedabad"],
  ["PNQ", "Pune Airport", "Pune"],
  ["GOI", "Dabolim Airport", "Goa"],
  ["GOX", "Manohar International Airport", "Goa (Mopa)"],
  ["COK", "Cochin International Airport", "Kochi"],
  ["TRV", "Trivandrum International Airport", "Thiruvananthapuram"],
  ["JAI", "Jaipur International Airport", "Jaipur"],
  ["LKO", "Chaudhary Charan Singh International Airport", "Lucknow"],
  ["ATQ", "Sri Guru Ram Dass Jee International Airport", "Amritsar"],
  ["IXC", "Chandigarh International Airport", "Chandigarh"],
  ["GAU", "Lokpriya Gopinath Bordoloi International Airport", "Guwahati"],
  ["PAT", "Jay Prakash Narayan International Airport", "Patna"],
  ["BBI", "Biju Patnaik International Airport", "Bhubaneswar"],
  ["IDR", "Devi Ahilya Bai Holkar Airport", "Indore"],
  ["NAG", "Dr. Babasaheb Ambedkar International Airport", "Nagpur"],
  ["VNS", "Lal Bahadur Shastri Airport", "Varanasi"],
  ["SXR", "Sheikh ul-Alam International Airport", "Srinagar"],
  ["IXB", "Bagdogra Airport", "Siliguri"],
  ["CJB", "Coimbatore International Airport", "Coimbatore"],
  ["IXM", "Madurai Airport", "Madurai"],
  ["VTZ", "Visakhapatnam Airport", "Visakhapatnam"],
  ["HBX", "Hubballi Airport", "Hubballi"],
  ["IXE", "Mangaluru International Airport", "Mangaluru"],
  ["RPR", "Swami Vivekananda Airport", "Raipur"],
  ["DED", "Jolly Grant Airport", "Dehradun"],
  ["UDR", "Maharana Pratap Airport", "Udaipur"],
  ["JDH", "Jodhpur Airport", "Jodhpur"],
  ["IXR", "Birsa Munda Airport", "Ranchi"],
  ["BHO", "Raja Bhoj Airport", "Bhopal"],
  ["SLV", "Shimla Airport", "Shimla"],
  ["DXB", "Dubai International Airport", "Dubai"],
  ["SIN", "Singapore Changi Airport", "Singapore"],
  ["LHR", "Heathrow Airport", "London"],
];

export const AIRPORT_PLACES: LocalPlace[] = AIRPORTS.map(([code, name, city]) => ({
  id: `airport:${code}`,
  kind: "airport",
  label: `${code} · ${name}`,
  detail: city,
  address: `${name}, ${city}`,
  keywords: `${code} airport ${city} terminal`,
}));

interface RichHotel {
  id: number | string | null;
  mapping_id: string;
  name: string;
  address: string;
  city: string;
}

export function hotelToPlace(h: RichHotel, airportCode: string): LocalPlace {
  const where = [h.address, h.city].filter(Boolean).join(", ");
  return {
    id: `hotel:${h.mapping_id || h.id}`,
    kind: "hotel",
    label: h.name,
    detail: where ? `Hotel · ${where}` : "Hotel",
    address: where ? `${h.name}, ${where}` : h.name,
    keywords: `hotel ${h.city} ${airportCode} ${h.mapping_id}`,
    hotelMappingId: h.mapping_id || undefined,
  };
}
