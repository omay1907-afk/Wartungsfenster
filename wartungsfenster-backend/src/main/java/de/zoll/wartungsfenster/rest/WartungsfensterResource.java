package de.zoll.wartungsfenster.rest;

import de.zoll.wartungsfenster.dto.NeuesWartungsfensterRequest;
import de.zoll.wartungsfenster.dto.WartungsfensterDto;
import de.zoll.wartungsfenster.entity.BugfixZuordnung;
import de.zoll.wartungsfenster.entity.Instanz;
import de.zoll.wartungsfenster.entity.Wartungsfenster;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Path("/wartungsfenster")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class WartungsfensterResource {

    @PersistenceContext(unitName = "wartungsfensterPU")
    EntityManager em;

    @GET
    public List<WartungsfensterDto> alle() {
        return em.createQuery("SELECT w FROM Wartungsfenster w ORDER BY w.datum", Wartungsfenster.class)
                .getResultList()
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @POST
    @Transactional
    public Response anlegen(NeuesWartungsfensterRequest req) {
        if (req.datum == null || req.datum.isBlank() || req.atlasRelease == null || req.atlasRelease.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity(Map.of("fehler", "Datum und ATLAS Release sind Pflichtfelder")).build();
        }

        long anzahl = em.createQuery("SELECT COUNT(w) FROM Wartungsfenster w", Long.class).getSingleResult();
        String nummer = String.format("%02d", anzahl + 1);

        Wartungsfenster wf = new Wartungsfenster();
        wf.setNummer(nummer);
        wf.setDatum(LocalDate.parse(req.datum));
        wf.setAtlasRelease(req.atlasRelease.trim());
        em.persist(wf);
        em.flush(); // kw wird von MySQL generiert - nach flush() erneut lesen

        // Ein neues Wartungsfenster startet bewusst OHNE übernommene Bugfixe/Markierungen:
        // für jede bestehende Instanz wird ein expliziter Leer-Eintrag angelegt, damit die
        // Fortschreibungslogik (v_bugfix_effektiv) hier nicht auf ältere Fenster zurückgreift.
        List<Instanz> instanzen = em.createQuery("SELECT i FROM Instanz i", Instanz.class).getResultList();
        for (Instanz i : instanzen) {
            BugfixZuordnung leer = new BugfixZuordnung();
            leer.setInstanz(i);
            leer.setWartungsfenster(wf);
            em.persist(leer);
        }

        em.flush();
        em.refresh(wf);
        return Response.status(Response.Status.CREATED).entity(toDto(wf)).build();
    }

    private WartungsfensterDto toDto(Wartungsfenster wf) {
        WartungsfensterDto dto = new WartungsfensterDto();
        dto.id = wf.getId();
        dto.nummer = wf.getNummer();
        dto.datum = wf.getDatum().toString();
        dto.kw = wf.getKw();
        dto.atlasRelease = wf.getAtlasRelease();
        return dto;
    }
}
