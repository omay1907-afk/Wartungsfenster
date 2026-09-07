package de.zoll.wartungsfenster.rest;

import de.zoll.wartungsfenster.dto.DomaeneDto;
import de.zoll.wartungsfenster.entity.Domaene;
import de.zoll.wartungsfenster.entity.Servergruppe;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Path("/domaenen")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class DomaeneResource {

    @PersistenceContext(unitName = "wartungsfensterPU")
    EntityManager em;

    @GET
    public List<DomaeneDto> alle() {
        return em.createQuery("SELECT d FROM Domaene d ORDER BY d.name", Domaene.class)
                .getResultList()
                .stream()
                .map(d -> new DomaeneDto(d.getId(), d.getName()))
                .collect(Collectors.toList());
    }

    @POST
    @Transactional
    public Response anlegen(Map<String, String> body) {
        String name = body.get("name");
        if (name == null || name.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity(Map.of("fehler", "Name darf nicht leer sein")).build();
        }
        Domaene d = new Domaene();
        d.setName(name.trim());
        em.persist(d);
        em.flush();
        return Response.status(Response.Status.CREATED).entity(new DomaeneDto(d.getId(), d.getName())).build();
    }

    @PUT
    @Path("/{id}")
    @Transactional
    public DomaeneDto umbenennen(@PathParam("id") Long id, Map<String, String> body) {
        Domaene d = em.find(Domaene.class, id);
        if (d == null) throw new NotFoundException("Domäne nicht gefunden");
        String name = body.get("name");
        if (name != null && !name.isBlank()) d.setName(name.trim());
        return new DomaeneDto(d.getId(), d.getName());
    }

    @DELETE
    @Path("/{id}")
    @Transactional
    public Response loeschen(@PathParam("id") Long id) {
        Domaene d = em.find(Domaene.class, id);
        if (d == null) return Response.status(Response.Status.NOT_FOUND).build();
        // Betroffene Servergruppen auf "ohne Domäne" setzen, statt das Löschen zu blockieren
        List<Servergruppe> betroffene = em.createQuery(
                "SELECT s FROM Servergruppe s WHERE s.domaene.id = :id", Servergruppe.class)
                .setParameter("id", id)
                .getResultList();
        betroffene.forEach(s -> s.setDomaene(null));
        em.remove(d);
        return Response.noContent().build();
    }
}
