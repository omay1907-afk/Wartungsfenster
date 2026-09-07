package de.zoll.wartungsfenster.rest;

import de.zoll.wartungsfenster.dto.NeueServergruppeRequest;
import de.zoll.wartungsfenster.dto.ServergruppeDto;
import de.zoll.wartungsfenster.entity.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Path("/servergruppen")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ServergruppeResource {

    @PersistenceContext(unitName = "wartungsfensterPU")
    EntityManager em;

    @GET
    public List<ServergruppeDto> alle() {
        return em.createQuery("SELECT s FROM Servergruppe s ORDER BY s.umgebung.sortierung, s.instanz.name", Servergruppe.class)
                .getResultList()
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @POST
    @Transactional
    public Response anlegen(NeueServergruppeRequest req) {
        if (req.instanzName == null || req.instanzName.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity(Map.of("fehler", "Instanzname darf nicht leer sein")).build();
        }
        if (req.umgebungCodes == null || req.umgebungCodes.isEmpty()) {
            return Response.status(Response.Status.BAD_REQUEST).entity(Map.of("fehler", "Mindestens eine Umgebung auswählen")).build();
        }

        String name = req.instanzName.trim();
        Instanz instanz;
        try {
            instanz = em.createQuery("SELECT i FROM Instanz i WHERE i.name = :name", Instanz.class)
                    .setParameter("name", name)
                    .getSingleResult();
        } catch (NoResultException e) {
            instanz = new Instanz();
            instanz.setName(name);
            em.persist(instanz);
        }

        // Konflikte vorab prüfen: existiert die Instanz schon in einer der Zielumgebungen?
        List<String> belegt = em.createQuery(
                "SELECT s.umgebung.code FROM Servergruppe s WHERE s.instanz = :instanz AND s.umgebung.code IN :codes", String.class)
                .setParameter("instanz", instanz)
                .setParameter("codes", req.umgebungCodes)
                .getResultList();
        if (!belegt.isEmpty()) {
            return Response.status(Response.Status.CONFLICT)
                    .entity(Map.of("fehler", "Instanz \"" + name + "\" existiert bereits in: " + String.join(", ", belegt)))
                    .build();
        }

        Domaene domaene = req.domainId != null ? em.find(Domaene.class, req.domainId) : null;

        List<ServergruppeDto> erstellt = new ArrayList<>();
        for (String code : req.umgebungCodes) {
            Umgebung umgebung = em.find(Umgebung.class, code);
            if (umgebung == null) continue;

            Servergruppe sg = new Servergruppe();
            sg.setInstanz(instanz);
            sg.setUmgebung(umgebung);
            sg.setDomaene(domaene);
            sg.setJbossAdmin(nvl(req.jbossAdmin));
            sg.setJiraKennzeichen(nvl(req.jiraKennzeichen));
            sg.setAnsprechpartner(nvl(req.ansprechpartner));
            sg.setAufrufadresse(nvl(req.aufrufadresse));
            sg.setSoaEndpunkte(nvl(req.soaEndpunkte));
            em.persist(sg);

            if (req.artefaktVorlagen != null) {
                for (String vorlage : req.artefaktVorlagen) {
                    if (vorlage == null || vorlage.isBlank()) continue;
                    ServergruppeArtefaktVorlage av = new ServergruppeArtefaktVorlage();
                    av.setServergruppe(sg);
                    av.setVorlage(vorlage.trim());
                    em.persist(av);
                    sg.getArtefaktVorlagen().add(av);
                }
            }
            erstellt.add(toDto(sg));
        }

        em.flush();
        return Response.status(Response.Status.CREATED).entity(erstellt).build();
    }

    @PUT
    @Path("/{id}")
    @Transactional
    public ServergruppeDto aktualisieren(@PathParam("id") Long id, Map<String, Object> body) {
        Servergruppe sg = em.find(Servergruppe.class, id);
        if (sg == null) throw new NotFoundException("Servergruppe nicht gefunden");

        if (body.containsKey("jbossAdmin")) sg.setJbossAdmin(str(body.get("jbossAdmin")));
        if (body.containsKey("jiraKennzeichen")) sg.setJiraKennzeichen(str(body.get("jiraKennzeichen")));
        if (body.containsKey("ansprechpartner")) sg.setAnsprechpartner(str(body.get("ansprechpartner")));
        if (body.containsKey("aufrufadresse")) sg.setAufrufadresse(str(body.get("aufrufadresse")));
        if (body.containsKey("soaEndpunkte")) sg.setSoaEndpunkte(str(body.get("soaEndpunkte")));

        if (body.containsKey("domainId")) {
            Object v = body.get("domainId");
            sg.setDomaene(v == null ? null : em.find(Domaene.class, ((Number) v).longValue()));
        }

        if (body.containsKey("name")) {
            String neuerName = str(body.get("name"));
            if (neuerName != null && !neuerName.isBlank() && !neuerName.equals(sg.getInstanz().getName())) {
                sg.getInstanz().setName(neuerName.trim());
            }
        }

        if (body.containsKey("colors")) {
            Map<String, String> colorMap = new LinkedHashMap<>();
            Object c = body.get("colors");
            if (c instanceof Map<?, ?> m) {
                m.forEach((k, val) -> colorMap.put(String.valueOf(k), String.valueOf(val)));
            }
            sg.setFarben(colorMap);
        }

        if (body.containsKey("artefaktVorlagen")) {
            sg.getArtefaktVorlagen().clear();
            Object av = body.get("artefaktVorlagen");
            if (av instanceof List<?> list) {
                for (Object o : list) {
                    if (o == null) continue;
                    String v = String.valueOf(o);
                    if (v.isBlank()) continue;
                    ServergruppeArtefaktVorlage vorlage = new ServergruppeArtefaktVorlage();
                    vorlage.setServergruppe(sg);
                    vorlage.setVorlage(v.trim());
                    sg.getArtefaktVorlagen().add(vorlage);
                }
            }
        }

        em.flush();
        return toDto(sg);
    }

    private ServergruppeDto toDto(Servergruppe sg) {
        ServergruppeDto dto = new ServergruppeDto();
        dto.id = sg.getId();
        dto.instanzId = sg.getInstanz().getId();
        dto.name = sg.getInstanz().getName();
        dto.umgebungCode = sg.getUmgebung().getCode();
        dto.domainId = sg.getDomaene() != null ? sg.getDomaene().getId() : null;
        dto.jbossAdmin = sg.getJbossAdmin();
        dto.jiraKennzeichen = sg.getJiraKennzeichen();
        dto.ansprechpartner = sg.getAnsprechpartner();
        dto.aufrufadresse = sg.getAufrufadresse();
        dto.soaEndpunkte = sg.getSoaEndpunkte();
        dto.artefaktVorlagen = sg.getArtefaktVorlagen().stream().map(ServergruppeArtefaktVorlage::getVorlage).collect(Collectors.toList());
        dto.colors = sg.getFarben();
        return dto;
    }

    private static String nvl(String s) { return s == null ? "" : s; }
    private static String str(Object o) { return o == null ? null : String.valueOf(o); }
}
