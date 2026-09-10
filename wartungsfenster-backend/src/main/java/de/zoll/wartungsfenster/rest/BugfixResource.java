package de.zoll.wartungsfenster.rest;

import de.zoll.wartungsfenster.dto.BugfixZuordnungDto;
import de.zoll.wartungsfenster.entity.BugfixZuordnung;
import de.zoll.wartungsfenster.entity.Instanz;
import de.zoll.wartungsfenster.entity.Wartungsfenster;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Path("")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class BugfixResource {

    @PersistenceContext(unitName = "wartungsfensterPU")
    EntityManager em;

    @GET
    @Path("/bugfix-zuordnungen")
    public List<BugfixZuordnungDto> alle() {
        return em.createQuery("SELECT b FROM BugfixZuordnung b", BugfixZuordnung.class)
                .getResultList()
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @PUT
    @Path("/instanzen/{instanzId}/bugfix/{wartungsfensterId}")
    @Transactional
    public BugfixZuordnungDto speichern(@PathParam("instanzId") Long instanzId,
                                         @PathParam("wartungsfensterId") Long wartungsfensterId,
                                         BugfixZuordnungDto body) {
        Instanz instanz = em.find(Instanz.class, instanzId);
        Wartungsfenster wf = em.find(Wartungsfenster.class, wartungsfensterId);
        if (instanz == null) throw new NotFoundException("Instanz nicht gefunden");
        if (wf == null) throw new NotFoundException("Wartungsfenster nicht gefunden");

        BugfixZuordnung z;
        try {
            z = em.createQuery(
                    "SELECT b FROM BugfixZuordnung b WHERE b.instanz = :i AND b.wartungsfenster = :w", BugfixZuordnung.class)
                    .setParameter("i", instanz)
                    .setParameter("w", wf)
                    .getSingleResult();
        } catch (NoResultException e) {
            z = new BugfixZuordnung();
            z.setInstanz(instanz);
            z.setWartungsfenster(wf);
            em.persist(z);
        }

        z.setBugfixNr(body.bugfixNr == null ? "" : body.bugfixNr);
        z.setProperties("ja".equals(body.properties) ? BugfixZuordnung.Properties.ja : BugfixZuordnung.Properties.nein);
        z.setNexusLink(body.nexusLink == null ? "" : body.nexusLink);
        z.setBemerkung(body.bemerkung == null ? "" : body.bemerkung);
        z.setEingespielt(body.eingespielt);
        Map<String, String> colors = new LinkedHashMap<>();
        if (body.colors != null) colors.putAll(body.colors);
        z.setFarben(colors);

        em.flush();
        return toDto(z);
    }

    private BugfixZuordnungDto toDto(BugfixZuordnung z) {
        BugfixZuordnungDto dto = new BugfixZuordnungDto();
        dto.instanzId = z.getInstanz().getId();
        dto.wartungsfensterId = z.getWartungsfenster().getId();
        dto.bugfixNr = z.getBugfixNr();
        dto.properties = z.getProperties().name();
        dto.nexusLink = z.getNexusLink();
        dto.bemerkung = z.getBemerkung();
        dto.eingespielt = z.isEingespielt();
        dto.colors = z.getFarben();
        return dto;
    }
}
